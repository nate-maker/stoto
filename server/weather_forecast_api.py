
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from fastapi import APIRouter, HTTPException, Query


router = APIRouter(
    prefix="/api/weather",
    tags=["Weather"],
)

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


@router.get("/forecast")
def get_weather_forecast(
    latitude: float = Query(
        ...,
        ge=-90,
        le=90,
        allow_inf_nan=False,
    ),
    longitude: float = Query(
        ...,
        ge=-180,
        le=180,
        allow_inf_nan=False,
    ),
) -> dict:

    parameters = {
        "latitude": latitude,
        "longitude": longitude,
        "current": (
            "temperature_2m,"
            "relative_humidity_2m,"
            "apparent_temperature,"
            "precipitation,"
            "weather_code,"
            "wind_speed_10m"
        ),
        "daily": (
            "weather_code,"
            "precipitation_probability_max,"
            "precipitation_sum,"
            "temperature_2m_max,"
            "temperature_2m_min,"
            "wind_speed_10m_max"
        ),
        "forecast_days": 14,
        "timezone": "auto",
        "temperature_unit": "celsius",
        "wind_speed_unit": "kmh",
        "precipitation_unit": "mm",
    }

    request_url = (
        f"{OPEN_METEO_URL}?{urlencode(parameters)}"
    )

    request = Request(
        request_url,
        headers={
            "User-Agent": "FieldWise-Weather/1.0",
        },
    )

    try:

        with urlopen(request, timeout=20) as response:

            forecast = json.loads(
                response.read().decode("utf-8")
            )

    except HTTPError as error:

        raise HTTPException(
            status_code=502,
            detail=f"Open-Meteo returned HTTP {error.code}.",
        ) from error

    except (URLError, TimeoutError) as error:

        raise HTTPException(
            status_code=502,
            detail="Could not reach Open-Meteo. Please try again.",
        ) from error

    except (UnicodeDecodeError, json.JSONDecodeError) as error:

        raise HTTPException(
            status_code=502,
            detail="Open-Meteo returned an unreadable response.",
        ) from error

    if not isinstance(forecast, dict):
        raise HTTPException(
            status_code=502,
            detail="Open-Meteo returned an unexpected response.",
        )

    current = forecast.get("current")
    daily = forecast.get("daily")

    if not current or not daily:
        raise HTTPException(
            status_code=502,
            detail=(
                "Weather response did not contain "
                "current and daily data."
            ),
        )

    return {
        "source": "Open-Meteo",
        "latitude": forecast.get("latitude", latitude),
        "longitude": forecast.get("longitude", longitude),
        "timezone": forecast.get("timezone"),
        "fetched_at_utc": current.get("time"),
        "current": current,
        "daily": daily,
    }
