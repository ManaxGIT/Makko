from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.schemas.common import ApiModel, to_camel

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class MealPreferences(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    meal: Text = Field(max_length=60)
    people: int = Field(ge=1, le=20)
    budget: int = Field(ge=1000, le=100_000_000)
    avoid: str = Field(default='', max_length=1000)
    pantry: str = Field(default='', max_length=1000)
    style: str = Field(default='', max_length=1000)


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


class MealSuggestion(ApiModel):
    title: Text = Field(min_length=3, max_length=120)
    description: Text = Field(max_length=500)
    cooking_minutes: int = Field(ge=1, le=1440)
    suggested_goods_amount: int = Field(gt=0, le=100_000_000)
    ingredients: list[MealIngredient] = Field(min_length=1, max_length=100)

    @model_validator(mode='after')
    def unique_ingredients(self) -> 'MealSuggestion':
        names = [i.name.casefold() for i in self.ingredients]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ingredients must be consolidated')
        return self


class MealSuggestions(ApiModel):
    suggestions: list[MealSuggestion] = Field(min_length=1, max_length=3)
