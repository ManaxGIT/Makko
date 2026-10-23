from typing import Annotated

from pydantic import ConfigDict, Field, StringConstraints, model_validator

from app.schemas.common import ApiModel, to_camel
from app.schemas.recipes import MealIngredient, RecipeSnapshot

Text = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class MealPreferences(ApiModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid')
    meal: Text = Field(max_length=60)
    people: int = Field(ge=1, le=20)
    budget: int = Field(ge=1000, le=100_000_000)
    avoid: str = Field(default='', max_length=1000)
    pantry: str = Field(default='', max_length=1000)
    style: str = Field(default='', max_length=1000)


class ShoppingIngredient(MealIngredient):
    note: str = Field(default='', max_length=500)


class MealSuggestion(ApiModel):
    title: Text = Field(min_length=3, max_length=120)
    description: Text = Field(max_length=500)
    cooking_minutes: int = Field(ge=1, le=1440)
    suggested_goods_amount: int = Field(gt=0, le=100_000_000)
    ingredients: list[ShoppingIngredient] = Field(min_length=1, max_length=100)
    recipe: RecipeSnapshot

    @model_validator(mode='after')
    def unique_ingredients(self) -> 'MealSuggestion':
        names = [i.name.casefold() for i in self.ingredients]
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ingredients must be consolidated')
        return self


class MealSuggestions(ApiModel):
    suggestions: list[MealSuggestion] = Field(min_length=3, max_length=3)

    @model_validator(mode='after')
    def unique_choices(self) -> 'MealSuggestions':
        titles = [s.title.casefold().strip() for s in self.suggestions]
        if len(titles) != len(set(titles)):
            raise ValueError('Suggestions must have different titles')
        return self
