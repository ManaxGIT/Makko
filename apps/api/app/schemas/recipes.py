from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints, field_validator

from app.schemas.common import ApiModel, to_camel


Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
RecipeText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1500)]


class MealIngredient(ApiModel):
    name: Text = Field(max_length=160)
    quantity: float = Field(gt=0, le=9_999_999, allow_inf_nan=False)
    unit: Text = Field(max_length=30)

    @field_validator('quantity')
    @classmethod
    def valid_precision(cls, value: float) -> float:
        if abs(value - round(value, 3)) > 1e-9:
            raise ValueError('Quantity supports at most three decimal places')
        return value


class RecipeSnapshot(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    title: Text = Field(min_length=3, max_length=120)
    cooking_minutes: int = Field(ge=1, le=1440)
    servings: int = Field(ge=1, le=20)
    ingredients: list[MealIngredient] = Field(min_length=1, max_length=100)
    steps: list[RecipeText] = Field(min_length=1, max_length=30)
