
import logging
import html
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline as SklearnPipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.impute import SimpleImputer

from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier

from sklearn.model_selection import (
    train_test_split,
    StratifiedKFold,
    cross_validate,
)

from sklearn.metrics import (
    accuracy_score,
    balanced_accuracy_score,
    f1_score,
    classification_report,
    confusion_matrix,
)

from sklearn.inspection import permutation_importance

from imblearn.pipeline import Pipeline as ImbPipeline
from imblearn.over_sampling import RandomOverSampler, SMOTE


# ============================================================
# CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

DATASET_PATH = (
    BASE_DIR
    / "Crop Recommendation using Soil Properties and Weather Prediction.csv"
)

# Experimental model. Does NOT overwrite model.pkl.
MODEL_PATH = BASE_DIR / "experiment_model.pkl"

TARGET = "label"

RANDOM_STATE = 42
TEST_SIZE = 0.20
MAX_CV_FOLDS = 5

# Keep fallow during the first experiment.
# It is a land-management class, not a crop species.
EXCLUDE_FALLOW = False

# Soil color is optional. It is included only if present.
INCLUDE_SOILCOLOR = True

# Organic carbon is optional. C:N is created only if detected.
ORGANIC_CARBON_CANDIDATES = [
    "OrganicCarbon",
    "Organic Carbon",
    "Organic_Carbon",
    "OC",
    "SOC",
    "SoilOrganicCarbon",
    "Soil Organic Carbon",
]


# ============================================================
# FEATURES
# ============================================================

SOIL_FEATURES = [
    "Ph",
    "K",
    "P",
    "N",
    "Zn",
    "S",
]

WEATHER_FEATURES = [
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

BASE_FEATURES = SOIL_FEATURES + WEATHER_FEATURES

# These weather features are an exploratory subset.
# Selection is based on the earlier permutation-importance
# investigation, so treat comparisons as exploratory.
SELECTED_WEATHER_FEATURES = [
    "PRECTOTCORR-W",
    "QV2M-W",
    "QV2M-Su",
    "T2M_MIN-Au",
    "PRECTOTCORR-Sp",
]

RATIO_FEATURES = [
    "N:P",
    "K:P",
]


# ============================================================
# LOGGING
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s: %(message)s",
)

logger = logging.getLogger(__name__)


# ============================================================
# CLEANING
# ============================================================

def clean_column_name(name):
    name = html.unescape(str(name))
    name = name.replace("*", "")
    name = name.replace("\ufeff", "")
    return name.strip()


def clean_text(value):
    if pd.isna(value):
        return np.nan

    value = html.unescape(str(value))
    value = re.sub(r"^\*+|\*+$", "", value)

    return value.strip()


def safe_ratio(numerator, denominator):
    numerator = pd.to_numeric(
        numerator,
        errors="coerce",
    )

    denominator = pd.to_numeric(
        denominator,
        errors="coerce",
    )

    valid = denominator.abs() > 1e-9

    result = pd.Series(
        np.nan,
        index=numerator.index,
        dtype=float,
    )

    result.loc[valid] = (
        numerator.loc[valid]
        / denominator.loc[valid]
    )

    return result.replace(
        [np.inf, -np.inf],
        np.nan,
    )


# ============================================================
# LOAD DATASET
# ============================================================

def load_dataset():

    logger.info("Loading dataset...")

    if not DATASET_PATH.exists():
        raise FileNotFoundError(DATASET_PATH)

    df = pd.read_csv(
        DATASET_PATH,
        encoding="utf-8-sig",
    )

    df.columns = [
        clean_column_name(column)
        for column in df.columns
    ]

    if df.columns.duplicated().any():
        raise ValueError(
            "Duplicate column names found."
        )

    required = BASE_FEATURES + [TARGET]

    missing = [
        column
        for column in required
        if column not in df.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    df[TARGET] = (
        df[TARGET]
        .apply(clean_text)
        .astype("string")
        .str.lower()
        .str.strip()
    )

    df = df[
        df[TARGET].notna()
        & df[TARGET].ne("")
    ].copy()

    if EXCLUDE_FALLOW:
        df = df[
            df[TARGET] != "fallow"
        ].copy()

    for column in BASE_FEATURES:
        df[column] = pd.to_numeric(
            df[column],
            errors="coerce",
        )

    df = df.replace(
        [np.inf, -np.inf],
        np.nan,
    )

    df = df.dropna(
        subset=[TARGET]
    )

    # Detect Soilcolor.
    soilcolor_available = (
        INCLUDE_SOILCOLOR
        and "Soilcolor" in df.columns
    )

    if soilcolor_available:
        df["Soilcolor"] = (
            df["Soilcolor"]
            .apply(clean_text)
            .astype("string")
            .str.lower()
        )

        df["Soilcolor"] = (
            df["Soilcolor"]
            .replace("", pd.NA)
        )

        print(
            "\nSoilcolor categories:"
        )

        print(
            df["Soilcolor"]
            .value_counts(dropna=False)
            .to_string()
        )

    # Nutrient ratios.
    df["N:P"] = safe_ratio(
        df["N"],
        df["P"],
    )

    df["K:P"] = safe_ratio(
        df["K"],
        df["P"],
    )

    # Detect organic carbon.
    carbon_column = next(
        (
            column
            for column in ORGANIC_CARBON_CANDIDATES
            if column in df.columns
        ),
        None,
    )

    if carbon_column:
        df[carbon_column] = pd.to_numeric(
            df[carbon_column],
            errors="coerce",
        )

        df["C:N"] = safe_ratio(
            df[carbon_column],
            df["N"],
        )

        print(
            f"\nOrganic carbon detected: {carbon_column}"
        )

    else:
        print(
            "\nOrganic carbon not found. C:N will not be used."
        )

    print("\nDATASET SUMMARY")
    print("=" * 65)

    print("Records:", len(df))
    print("Crop classes:", df[TARGET].nunique())

    print("\nCrop distribution:")

    print(
        df[TARGET]
        .value_counts()
        .to_string()
    )

    print("\nMissing values:")

    print(
        df[BASE_FEATURES]
        .isna()
        .sum()
        .to_string()
    )

    return df, soilcolor_available, carbon_column


# ============================================================
# FEATURE SETS
# ============================================================

def build_feature_sets(
    soilcolor_available,
    carbon_column,
):

    sets = {
        "All 27 features": {
            "numeric": BASE_FEATURES.copy(),
            "categorical": [],
        },

        "Soil only": {
            "numeric": SOIL_FEATURES.copy(),
            "categorical": [],
        },

        "Soil + selected weather": {
            "numeric": (
                SOIL_FEATURES
                + SELECTED_WEATHER_FEATURES
            ),
            "categorical": [],
        },

        "Soil + nutrient ratios": {
            "numeric": (
                SOIL_FEATURES
                + RATIO_FEATURES
            ),
            "categorical": [],
        },
    }

    advanced_numeric = (
        SOIL_FEATURES
        + WEATHER_FEATURES
        + RATIO_FEATURES
    )

    if carbon_column:
        advanced_numeric.append("C:N")

    advanced_categorical = []

    if soilcolor_available:
        advanced_categorical.append("Soilcolor")

    sets[
        "All features + Soilcolor + ratios"
    ] = {
        "numeric": advanced_numeric,
        "categorical": advanced_categorical,
    }

    if soilcolor_available:
        sets[
            "Soil + Soilcolor"
        ] = {
            "numeric": SOIL_FEATURES.copy(),
            "categorical": ["Soilcolor"],
        }

    return sets


# ============================================================
# PREPROCESSING
# ============================================================

def build_preprocessor(
    numeric_features,
    categorical_features,
):

    transformers = []

    if numeric_features:
        numeric_pipeline = SklearnPipeline([
            (
                "imputer",
                SimpleImputer(
                    strategy="median",
                ),
            ),
        ])

        transformers.append((
            "numeric",
            numeric_pipeline,
            numeric_features,
        ))

    if categorical_features:
        categorical_pipeline = SklearnPipeline([
            (
                "imputer",
                SimpleImputer(
                    strategy="most_frequent",
                ),
            ),

            (
                "encoder",
                OneHotEncoder(
                    handle_unknown="ignore",
                ),
            ),
        ])

        transformers.append((
            "categorical",
            categorical_pipeline,
            categorical_features,
        ))

    return ColumnTransformer(
        transformers=transformers,
        remainder="drop",
    )


# ============================================================
# MODEL PIPELINES
# ============================================================

def build_experiments(
    numeric_features,
    categorical_features,
):

    preprocessor = build_preprocessor(
        numeric_features,
        categorical_features,
    )

    experiments = {}

    classifiers = {
        "RF balanced": RandomForestClassifier(
            n_estimators=400,
            max_features="sqrt",
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),

        "RF balanced_subsample": RandomForestClassifier(
            n_estimators=400,
            max_features="sqrt",
            class_weight="balanced_subsample",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),

        "Extra Trees balanced": ExtraTreesClassifier(
            n_estimators=400,
            max_features="sqrt",
            class_weight="balanced",
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
    }

    for name, classifier in classifiers.items():

        experiments[name] = SklearnPipeline([
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ])

    # Resampling experiments.
    # SMOTE is used only when every feature is numeric.
    # Applying ordinary SMOTE to one-hot Soilcolor columns
    # would create invalid fractional categories.

    if not categorical_features:

        experiments["RF + Random Oversampling"] = ImbPipeline([
            ("preprocessor", preprocessor),
            (
                "sampler",
                RandomOverSampler(
                    random_state=RANDOM_STATE,
                ),
            ),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=400,
                    max_features="sqrt",
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                ),
            ),
        ])

        experiments["RF + SMOTE"] = ImbPipeline([
            ("preprocessor", preprocessor),
            (
                "sampler",
                SMOTE(
                    random_state=RANDOM_STATE,
                    k_neighbors=3,
                ),
            ),
            (
                "classifier",
                RandomForestClassifier(
                    n_estimators=400,
                    max_features="sqrt",
                    random_state=RANDOM_STATE,
                    n_jobs=-1,
                ),
            ),
        ])

    return experiments


# ============================================================
# CROSS-VALIDATION
# ============================================================

def compare_feature_set(
    name,
    feature_config,
    X_train,
    y_train,
):

    numeric = feature_config["numeric"]
    categorical = feature_config["categorical"]

    selected_columns = numeric + categorical

    X = X_train[selected_columns].copy()

    min_class_count = int(
        y_train.value_counts().min()
    )

    folds = min(
        MAX_CV_FOLDS,
        min_class_count,
    )

    if folds < 2:
        raise ValueError(
            "Insufficient records for stratified CV."
        )

    cv = StratifiedKFold(
        n_splits=folds,
        shuffle=True,
        random_state=RANDOM_STATE,
    )

    scoring = {
        "accuracy": "accuracy",
        "balanced_accuracy": "balanced_accuracy",
        "macro_f1": "f1_macro",
    }

    experiments = build_experiments(
        numeric,
        categorical,
    )

    results = []

    print("\n" + "=" * 75)
    print("FEATURE SET:", name)
    print("=" * 75)

    for model_name, model in experiments.items():

        print(
            f"\nTesting: {model_name}"
        )

        try:
            scores = cross_validate(
                model,
                X,
                y_train,
                cv=cv,
                scoring=scoring,
                n_jobs=1,
                error_score="raise",
            )

            result = {
                "feature_set": name,
                "model_name": model_name,
                "model": model,
                "columns": selected_columns,
                "cv_accuracy": scores[
                    "test_accuracy"
                ].mean(),
                "cv_balanced_accuracy": scores[
                    "test_balanced_accuracy"
                ].mean(),
                "cv_macro_f1": scores[
                    "test_macro_f1"
                ].mean(),
                "cv_macro_f1_std": scores[
                    "test_macro_f1"
                ].std(),
            }

            results.append(result)

            print(
                f"Accuracy: {result['cv_accuracy'] * 100:.2f}%"
            )

            print(
                f"Balanced accuracy: "
                f"{result['cv_balanced_accuracy'] * 100:.2f}%"
            )

            print(
                f"Macro F1: {result['cv_macro_f1'] * 100:.2f}%"
            )

        except Exception as error:
            logger.warning(
                "%s failed: %s",
                model_name,
                error,
            )

    return results


# ============================================================
# FINAL EVALUATION
# ============================================================

def evaluate_model(
    best,
    X_train,
    X_test,
    y_train,
    y_test,
):

    model = best["model"]

    columns = best["columns"]

    model.fit(
        X_train[columns],
        y_train,
    )

    predictions = model.predict(
        X_test[columns]
    )

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    balanced = balanced_accuracy_score(
        y_test,
        predictions,
    )

    macro_f1 = f1_score(
        y_test,
        predictions,
        average="macro",
        zero_division=0,
    )

    print("\n" + "=" * 75)
    print("EXPERIMENTAL HOLDOUT EVALUATION")
    print("=" * 75)

    print("Feature set:", best["feature_set"])
    print("Model:", best["model_name"])

    print(
        f"Accuracy: {accuracy * 100:.2f}%"
    )

    print(
        f"Balanced accuracy: {balanced * 100:.2f}%"
    )

    print(
        f"Macro F1: {macro_f1 * 100:.2f}%"
    )

    print("\nCLASSIFICATION REPORT")

    print(
        classification_report(
            y_test,
            predictions,
            zero_division=0,
        )
    )

    print("\nCONFUSION MATRIX")

    print(
        confusion_matrix(
            y_test,
            predictions,
            labels=model.classes_,
        )
    )

    return model, {
        "accuracy": float(accuracy),
        "balanced_accuracy": float(balanced),
        "macro_f1": float(macro_f1),
    }


# ============================================================
# FEATURE IMPORTANCE
# ============================================================

def show_feature_importance(
    model,
    X_test,
    y_test,
    columns,
):

    result = permutation_importance(
        model,
        X_test[columns],
        y_test,
        scoring="f1_macro",
        n_repeats=5,
        random_state=RANDOM_STATE,
        n_jobs=-1,
    )

    importance = pd.DataFrame({
        "feature": columns,
        "importance": result.importances_mean,
        "std": result.importances_std,
    }).sort_values(
        "importance",
        ascending=False,
    )

    print("\nFEATURE IMPORTANCE")

    print(
        importance.to_string(
            index=False,
            float_format=lambda value: f"{value:.5f}",
        )
    )


# ============================================================
# MAIN
# ============================================================

def main():

    print("\n" + "=" * 75)
    print("ETHIOPIAN SMART CROP RECOMMENDATION")
    print("MODEL IMPROVEMENT EXPERIMENTS")
    print("=" * 75)

    df, soilcolor_available, carbon_column = (
        load_dataset()
    )

    feature_sets = build_feature_sets(
        soilcolor_available,
        carbon_column,
    )

    all_columns = list(dict.fromkeys(
        column
        for config in feature_sets.values()
        for column in (
            config["numeric"]
            + config["categorical"]
        )
    ))

    X = df[all_columns].copy()
    y = df[TARGET].copy()

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=TEST_SIZE,
        stratify=y,
        random_state=RANDOM_STATE,
    )

    print("\nTraining records:", len(X_train))
    print("Testing records:", len(X_test))

    all_results = []

    for name, config in feature_sets.items():

        results = compare_feature_set(
            name,
            config,
            X_train,
            y_train,
        )

        all_results.extend(results)

    if not all_results:
        raise RuntimeError(
            "No experiments completed successfully."
        )

    all_results.sort(
        key=lambda item: (
            item["cv_macro_f1"],
            item["cv_balanced_accuracy"],
        ),
        reverse=True,
    )

    print("\n" + "=" * 75)
    print("EXPERIMENT RANKINGS")
    print("=" * 75)

    ranking = pd.DataFrame([
        {
            "Feature set": item["feature_set"],
            "Model": item["model_name"],
            "CV Accuracy": round(
                item["cv_accuracy"] * 100, 2
            ),
            "CV Balanced Accuracy": round(
                item["cv_balanced_accuracy"] * 100, 2
            ),
            "CV Macro F1": round(
                item["cv_macro_f1"] * 100, 2
            ),
        }
        for item in all_results
    ])

    print(
        ranking.to_string(index=False)
    )

    best = all_results[0]

    print("\nSelected experiment:")
    print(best["feature_set"])
    print(best["model_name"])

    model, evaluation = evaluate_model(
        best,
        X_train,
        X_test,
        y_train,
        y_test,
    )

    show_feature_importance(
        model,
        X_test,
        y_test,
        best["columns"],
    )

    # Save separately. Never overwrite production model.pkl.
    saved_data = {
        "model": model,
        "features": best["columns"],
        "numeric_features": [
            column
            for column in best["columns"]
            if column != "Soilcolor"
        ],
        "categorical_features": (
            ["Soilcolor"]
            if "Soilcolor" in best["columns"]
            else []
        ),
        "classes": list(model.classes_),
        "accuracy": evaluation["accuracy"],
        "balanced_accuracy": evaluation[
            "balanced_accuracy"
        ],
        "macro_f1": evaluation["macro_f1"],
        "cv_accuracy": best["cv_accuracy"],
        "cv_balanced_accuracy": best[
            "cv_balanced_accuracy"
        ],
        "cv_macro_f1": best["cv_macro_f1"],
        "selected_model": best["model_name"],
        "selected_feature_set": best["feature_set"],
        "target": TARGET,
        "training_version": "5.0.0-experiments",
        "production_compatible": (
            best["columns"] == BASE_FEATURES
        ),
    }

    joblib.dump(
        saved_data,
        MODEL_PATH,
    )

    print("\n" + "=" * 75)
    print("EXPERIMENTS COMPLETED")
    print("=" * 75)

    print("Best feature set:", best["feature_set"])
    print("Best model:", best["model_name"])

    print(
        f"Test macro F1: "
        f"{evaluation['macro_f1'] * 100:.2f}%"
    )

    print("Saved to:", MODEL_PATH)

    if not saved_data["production_compatible"]:
        print(
            "\nIMPORTANT: This model has a different feature "
            "contract from the current production model."
        )


if __name__ == "__main__":

    try:
        main()

    except KeyboardInterrupt:
        print("\nTraining stopped.")

    except Exception as error:
        logger.exception(
            "Experiment failed: %s",
            error,
        )
        print("ERROR:", error)
