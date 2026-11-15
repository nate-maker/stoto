import logging
import os
import math
from datetime import date, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

ENV_PATH = BASE_DIR / ".env"
MODEL_PATH = BASE_DIR / "model.pkl"

load_dotenv(ENV_PATH, override=True)

NASA_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
ISDA_URL = "https://api.isda-africa.com"

REQUEST_TIMEOUT = 60
WEATHER_YEARS = 5
SOIL_DEPTH = "0-20"

ALLOW_UNVALIDATED_PREDICTIONS = (
    os.getenv("ALLOW_UNVALIDATED_PREDICTIONS", "false").lower()
    == "true"
)

SEASONS = {
    "W": [12, 1, 2],
    "Sp": [3, 4, 5],
    "Su": [6, 7, 8],
    "Au": [9, 10, 11],
}

FEATURES = [
    "Ph",
    "K",
    "P",
    "N",
    "Zn",
    "S",
    "QV2M-W",
    "QV2M-Sp",
    "QV2M-Su",
    "QV2M-Au",
    "T2M_MAX-W",
    "T2M_MAX-Sp",
    "T2M_MAX-Su",
    "T2M_MAX-Au",
    "T2M_MIN-W",
    "T2M_MIN-Sp",
    "T2M_MIN-Su",
    "T2M_MIN-Au",
    "PRECTOTCORR-W",
    "PRECTOTCORR-Sp",
    "PRECTOTCORR-Su",
    "PRECTOTCORR-Au",
    "WD10M",
    "GWETTOP",
    "CLOUD_AMT",
    "WS2M_RANGE",
    "PS",
]

NASA_PARAMETERS = [
    "QV2M",
    "T2M_MAX",
    "T2M_MIN",
    "PRECTOTCORR",
    "WD10M",
    "GWETTOP",
    "CLOUD_AMT",
    "WS2M_RANGE",
    "PS",
]

RAINFALL_AGGREGATION = os.getenv(
    "RAINFALL_AGGREGATION",
    "mean",
).lower()

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)

logger = logging.getLogger(__name__)

SESSION = requests.Session()

SESSION.headers.update({
    "User-Agent": "EthiopianSmartCropRecommendation/2.0"
})


# ============================================================
# GENERAL HELPERS
# ============================================================

def validate_coordinates(latitude, longitude):

    latitude = float(latitude)
    longitude = float(longitude)

    if not math.isfinite(latitude) or not -90 <= latitude <= 90:
        raise ValueError("Invalid latitude.")

    if not math.isfinite(longitude) or not -180 <= longitude <= 180:
        raise ValueError("Invalid longitude.")

    return latitude, longitude


def get_json(url, params=None, headers=None, timeout=REQUEST_TIMEOUT):

    try:
        response = SESSION.get(
            url,
            params=params,
            headers=headers,
            timeout=timeout,
        )

        if not response.ok:
            raise RuntimeError(
                f"API request failed ({response.status_code}): "
                f"{response.text[:1000]}"
            )

        try:
            return response.json()

        except ValueError as error:
            raise RuntimeError(
                f"API returned invalid JSON: {response.text[:500]}"
            ) from error

    except requests.RequestException as error:
        raise RuntimeError(
            f"Network request failed: {error}"
        ) from error


# ============================================================
# LOAD TRAINED MODEL
# ============================================================

def load_model():

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            "model.pkl not found. Run train.py first."
        )

    saved = joblib.load(MODEL_PATH)

    if not isinstance(saved, dict):
        raise ValueError(
            "Invalid model.pkl. Expected a model dictionary."
        )

    model = saved.get("model")
    saved_features = saved.get("features")

    if model is None:
        raise ValueError("No trained model found.")

    if saved_features != FEATURES:
        raise ValueError(
            "Model features do not match recommend.py.\n"
            f"Expected: {FEATURES}\n"
            f"Found: {saved_features}"
        )

    if saved.get("version") != "3.0.0-ethiopia":
        raise ValueError(
            f"Unexpected model version: {saved.get('version')}"
        )

    if not hasattr(model, "predict_proba"):
        raise ValueError(
            "Model does not support probability predictions."
        )

    return saved


# ============================================================
# NASA POWER WEATHER DATA
# ============================================================

def clean_daily_values(raw_values):

    result = {}

    for day, raw_value in raw_values.items():

        try:
            value = float(raw_value)
        except (TypeError, ValueError):
            continue

        if not math.isfinite(value) or value <= -900:
            continue

        result[day] = value

    return result


def circular_mean_degrees(values):

    if not values:
        raise ValueError("No wind direction measurements.")

    radians = np.radians(values)

    sin_mean = np.mean(np.sin(radians))
    cos_mean = np.mean(np.cos(radians))

    angle = math.degrees(
        math.atan2(sin_mean, cos_mean)
    )

    return round(angle % 360, 4)


def get_weather(latitude, longitude):

    logger.info("Fetching historical weather from NASA POWER.")

    if RAINFALL_AGGREGATION not in ("mean", "sum"):
        raise ValueError(
            "RAINFALL_AGGREGATION must be 'mean' or 'sum'."
        )

    end_date = date.today() - timedelta(days=1)

    start_date = date(
        end_date.year - WEATHER_YEARS,
        end_date.month,
        1,
    )

    params = {
        "parameters": ",".join(NASA_PARAMETERS),
        "community": "AG",
        "longitude": longitude,
        "latitude": latitude,
        "start": start_date.strftime("%Y%m%d"),
        "end": end_date.strftime("%Y%m%d"),
        "format": "JSON",
    }

    data = get_json(
        NASA_URL,
        params=params,
        timeout=90,
    )

    try:
        raw_parameters = data["properties"]["parameter"]
    except (KeyError, TypeError) as error:
        raise RuntimeError(
            "Unexpected NASA POWER response."
        ) from error

    weather = {}

    for parameter in NASA_PARAMETERS:

        if parameter not in raw_parameters:
            raise RuntimeError(
                f"NASA POWER did not return {parameter}."
            )

        weather[parameter] = clean_daily_values(
            raw_parameters[parameter]
        )

        if not weather[parameter]:
            raise RuntimeError(
                f"No valid NASA data for {parameter}."
            )

    # --------------------------------------------------------
    # SEASONAL FEATURES
    # --------------------------------------------------------

    for season, months in SEASONS.items():

        for parameter in [
            "QV2M",
            "T2M_MAX",
            "T2M_MIN",
            "PRECTOTCORR",
        ]:

            values = [
                value
                for day, value in weather[parameter].items()
                if int(day[4:6]) in months
            ]

            if not values:
                raise RuntimeError(
                    f"No {parameter} data for season {season}."
                )

            if parameter == "PRECTOTCORR" and (
                RAINFALL_AGGREGATION == "sum"
            ):
                result = sum(values)
            else:
                result = sum(values) / len(values)

            weather[f"{parameter}-{season}"] = round(
                result,
                6,
            )

    # --------------------------------------------------------
    # ANNUAL FEATURES
    # --------------------------------------------------------

    for parameter in [
        "WD10M",
        "GWETTOP",
        "CLOUD_AMT",
        "WS2M_RANGE",
        "PS",
    ]:

        values = list(weather[parameter].values())

        if parameter == "WD10M":
            result = circular_mean_degrees(values)
        else:
            result = sum(values) / len(values)

        weather[parameter] = round(result, 6)

    logger.info("NASA POWER weather retrieval completed.")

    return weather


# ============================================================
# ISDASOIL AUTHENTICATION
# ============================================================

def get_isda_token():

    username = os.getenv("ISDA_USERNAME")
    password = os.getenv("ISDA_PASSWORD")

    if not username or not password:
        raise RuntimeError(
            "Missing ISDA_USERNAME or ISDA_PASSWORD in .env."
        )

    try:
        response = SESSION.post(
            f"{ISDA_URL}/login",
            data={
                "username": username,
                "password": password,
            },
            timeout=30,
        )

        response.raise_for_status()

        token = response.json().get("access_token")

        if not token:
            raise RuntimeError(
                "iSDAsoil did not return an access token."
            )

        logger.info("iSDAsoil authentication successful.")

        return token

    except requests.RequestException as error:
        raise RuntimeError(
            f"iSDAsoil login failed: {error}"
        ) from error


# ============================================================
# FETCH ONE SOIL PROPERTY
# ============================================================

def get_soil_property(
    token,
    latitude,
    longitude,
    property_name,
):

    try:
        response = SESSION.get(
            f"{ISDA_URL}/isdasoil/v2/soilproperty",
            headers={
                "Authorization": f"Bearer {token}",
            },
            params={
                "lat": latitude,
                "lon": longitude,
                "property": property_name,
                "depth": SOIL_DEPTH,
            },
            timeout=REQUEST_TIMEOUT,
        )

        if not response.ok:
            raise RuntimeError(
                f"iSDAsoil {property_name} failed "
                f"({response.status_code}): "
                f"{response.text[:500]}"
            )

        data = response.json()

        property_results = data["property"][property_name]

        if not property_results:
            raise ValueError("No property results returned.")

        first_result = property_results[0]
        value_data = first_result["value"]

        if isinstance(value_data, dict):
            value = value_data["value"]
            unit = value_data.get("unit")
        else:
            value = value_data
            unit = None

        value = float(value)

        if not math.isfinite(value):
            raise ValueError("Invalid soil value.")

        return {
            "value": value,
            "unit": unit,
            "property": property_name,
            "uncertainty": first_result.get("uncertainty"),
        }

    except requests.RequestException as error:
        raise RuntimeError(
            f"Network error retrieving {property_name}: {error}"
        ) from error

    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise RuntimeError(
            f"Unexpected iSDAsoil response for "
            f"{property_name}: {error}"
        ) from error


# ============================================================
# FETCH ALL SIX SOIL FEATURES
# ============================================================

def get_soil_data(latitude, longitude):

    logger.info("Fetching soil data from iSDAsoil.")

    token = get_isda_token()

    properties = {
        "N": "nitrogen_total",
        "P": "phosphorous_extractable",
        "K": "potassium_extractable",
        "Ph": "ph",
        "Zn": "zinc_extractable",
        "S": "sulphur_extractable",
    }

    soil = {}

    for feature, property_name in properties.items():

        logger.info("Retrieving soil property: %s", feature)

        result = get_soil_property(
            token,
            latitude,
            longitude,
            property_name,
        )

        soil[feature] = result

    logger.info("iSDAsoil retrieval completed.")

    return soil


# ============================================================
# BUILD MODEL INPUT
# ============================================================

def prepare_model_input(soil, weather):

    values = {}

    # Soil features
    for feature in ["Ph", "K", "P", "N", "Zn", "S"]:

        if feature not in soil:
            raise ValueError(
                f"Missing soil feature: {feature}"
            )

        values[feature] = soil[feature]["value"]

    # Seasonal weather
    for season in SEASONS:

        for parameter in [
            "QV2M",
            "T2M_MAX",
            "T2M_MIN",
            "PRECTOTCORR",
        ]:

            feature = f"{parameter}-{season}"

            if feature not in weather:
                raise ValueError(
                    f"Missing weather feature: {feature}"
                )

            values[feature] = weather[feature]

    # Other climate features
    for parameter in [
        "WD10M",
        "GWETTOP",
        "CLOUD_AMT",
        "WS2M_RANGE",
        "PS",
    ]:

        if parameter not in weather:
            raise ValueError(
                f"Missing weather feature: {parameter}"
            )

        values[parameter] = weather[parameter]

    missing_features = [
        feature
        for feature in FEATURES
        if feature not in values
    ]

    if missing_features:
        raise ValueError(
            f"Missing model features: {missing_features}"
        )

    input_data = pd.DataFrame(
        [[values[feature] for feature in FEATURES]],
        columns=FEATURES,
    )

    if input_data.isnull().any().any():
        raise ValueError(
            "Prediction input contains missing values."
        )

    if not np.isfinite(
        input_data.to_numpy(dtype=float)
    ).all():
        raise ValueError(
            "Prediction input contains invalid numeric values."
        )

    return input_data


# ============================================================
# DATA COMPATIBILITY CHECK
# ============================================================

def check_compatibility(soil):

    logger.info("Checking model input compatibility.")

    for feature in ["N", "P", "K", "Ph", "Zn", "S"]:

        item = soil[feature]

        logger.info(
            "%s: %s %s",
            feature,
            item["value"],
            item["unit"] or "(unit not supplied)",
        )

    if not ALLOW_UNVALIDATED_PREDICTIONS:

        logger.warning(
            "Predictions disabled. Input compatibility "
            "has not been confirmed."
        )

        return False

    logger.warning(
        "Prediction override enabled. Results remain "
        "experimental until independently validated."
    )

    return True


# ============================================================
# CROP PREDICTION
# ============================================================

def predict_crops(model_data, input_data):

    model = model_data["model"]

    probabilities = model.predict_proba(input_data)[0]
    classes = model.classes_

    results = sorted(
        zip(classes, probabilities),
        key=lambda item: item[1],
        reverse=True,
    )

    return results
