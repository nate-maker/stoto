
import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import recommend
import weather_forecast_api


# ============================================================
# CONFIGURATION
# ============================================================

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Ethiopian Smart Crop Recommendation API",
    description="Browser GPS-based crop recommendation system",
    version="1.0.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


# ============================================================
# WEATHER ROUTER
# ============================================================

app.include_router(weather_forecast_api.router)


# ============================================================
# REQUEST MODEL
# ============================================================

class LocationRequest(BaseModel):

    latitude: float = Field(
        ge=-90,
        le=90,
        allow_inf_nan=False,
    )

    longitude: float = Field(
        ge=-180,
        le=180,
        allow_inf_nan=False,
    )

    accuracy: float | None = Field(
        default=None,
        gt=0,
        allow_inf_nan=False,
    )


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def home():

    return {
        "success": True,
        "message": "Ethiopian Smart Crop Recommendation API is running.",
    }


@app.get("/health")
def health():

    return {
        "success": True,
        "status": "healthy",
    }


# ============================================================
# CROP RECOMMENDATION
# ============================================================

@app.post("/recommend")
def recommend_crop(request: LocationRequest):

    try:

        latitude, longitude = recommend.validate_coordinates(
            request.latitude,
            request.longitude,
        )

        logger.info(
            "New recommendation request: latitude=%s longitude=%s",
            latitude,
            longitude,
        )

        # ----------------------------------------------------
        # 1. LOCATION
        # ----------------------------------------------------

        location = {
            "latitude": latitude,
            "longitude": longitude,
            "accuracy": request.accuracy,
            "method": "Browser Geolocation",
        }

        # ----------------------------------------------------
        # 2. LOAD MODEL
        # ----------------------------------------------------

        model_data = recommend.load_model()

        # ----------------------------------------------------
        # 3. FETCH HISTORICAL WEATHER
        # ----------------------------------------------------

        weather = recommend.get_weather(
            latitude,
            longitude,
        )

        # ----------------------------------------------------
        # 4. FETCH SOIL
        # ----------------------------------------------------

        soil = recommend.get_soil_data(
            latitude,
            longitude,
        )

        # ----------------------------------------------------
        # 5. PREPARE MODEL INPUT
        # ----------------------------------------------------

        input_data = recommend.prepare_model_input(
            soil,
            weather,
        )

        # ----------------------------------------------------
        # 6. COMPATIBILITY CHECK
        # ----------------------------------------------------

        compatible = recommend.check_compatibility(soil)

        model_input = {
            feature: float(input_data.iloc[0][feature])
            for feature in recommend.FEATURES
        }

        response_data = {
            "success": True,
            "location": location,
            "soil": soil,
            "weather": weather,
            "model_input": model_input,
        }

        # ----------------------------------------------------
        # 7. STOP IF PREDICTIONS ARE DISABLED
        # ----------------------------------------------------

        if not compatible:

            return {
                **response_data,
                "prediction_enabled": False,
                "message": (
                    "Soil and weather data were collected. "
                    "Predictions remain disabled until "
                    "input compatibility is validated."
                ),
                "recommendations": [],
            }

        # ----------------------------------------------------
        # 8. PREDICT
        # ----------------------------------------------------

        results = recommend.predict_crops(
            model_data,
            input_data,
        )

        recommendations = [
            {
                "crop": str(crop),
                "probability": float(probability),
                "percentage": round(
                    float(probability) * 100,
                    2,
                ),
            }
            for crop, probability in results[:5]
        ]

        # ----------------------------------------------------
        # 9. RETURN RESULTS
        # ----------------------------------------------------

        return {
            **response_data,
            "prediction_enabled": True,
            "message": "Recommendations generated successfully.",
            "recommendations": recommendations,
            "warning": (
                "Model probabilities are not guarantees of "
                "crop success, suitability, or yield."
            ),
        }

    except HTTPException:
        raise

    except Exception as error:

        logger.exception("Crop recommendation failed.")

        raise HTTPException(
            status_code=500,
            detail=(
                "Crop recommendation failed. "
                "Check the backend logs for details."
            ),
        ) from error
