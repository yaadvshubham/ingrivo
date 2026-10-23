from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from app.schemas.product import (
    Product,
    Provenance,
    NutritionBasis,
    NutritionData,
    NutrientValues,
    IngredientsData,
    AllergensData,
    SourceData,
    CompletenessData,
    SourceComputedData
)

def normalize_off_product(raw_data: Dict[str, Any], api_version: str) -> Product:
    """
    Transforms raw Open Food Facts product JSON into our normalized Product schema.
    Rules:
    - Missing stays null. Never convert missing values to 0.
    - If nutrition basis cannot be determined, set to unknown.
    - Prefer English ingredient text if present, else default.
    - Allergens empty list means 'none declared in source data / unknown', never 'allergen-free'.
    """
    code = str(raw_data.get("code", "")).strip()
    
    # 1. Product Identification
    name = raw_data.get("product_name") or None
    brand = raw_data.get("brands") or None
    quantity = raw_data.get("quantity") or None
    image_url = (
        raw_data.get("image_url")
        or raw_data.get("image_front_url")
        or raw_data.get("selected_images", {}).get("front", {}).get("display", {}).get("en")
        or None
    )
    
    # Categories
    categories_raw = raw_data.get("categories", "")
    categories: List[str] = []
    if categories_raw:
        categories = [c.strip() for c in categories_raw.split(",") if c.strip()]
        
    # 2. Nutrition
    raw_basis = raw_data.get("nutrition_data_per") or raw_data.get("nutrition_data_prepared_per")
    basis = NutritionBasis.unknown
    if raw_basis == "100g":
        basis = NutritionBasis.per_100g
    elif raw_basis == "100ml":
        basis = NutritionBasis.per_100ml
    elif raw_basis == "serving":
        basis = NutritionBasis.per_serving
        
    nutriments = raw_data.get("nutriments", {})
    
    # Helper to retrieve nutrient value
    def get_nutrient(key: str) -> Optional[float]:
        # Look for explicit basis suffix or generic value
        candidates = [
            f"{key}_100g" if basis in (NutritionBasis.per_100g, NutritionBasis.per_100ml) else None,
            f"{key}_serving" if basis == NutritionBasis.per_serving else None,
            f"{key}_value",
            key
        ]
        for c in candidates:
            if c and c in nutriments and nutriments[c] is not None:
                try:
                    return float(nutriments[c])
                except (ValueError, TypeError):
                    pass
        return None

    energy_kcal = get_nutrient("energy-kcal")
    energy_kj = get_nutrient("energy-kj")
    if energy_kj is None:
        energy_kj = get_nutrient("energy")
    sugars = get_nutrient("sugars")
    protein = get_nutrient("proteins")
    if protein is None:
        protein = get_nutrient("protein")
    fat = get_nutrient("fat")
    saturated_fat = get_nutrient("saturated-fat")
    carbohydrates = get_nutrient("carbohydrates")
    fibre = get_nutrient("fiber")
    if fibre is None:
        fibre = get_nutrient("fibre")
    sodium = get_nutrient("sodium")
    salt = get_nutrient("salt")
    
    nutrient_values = NutrientValues(
        energy_kcal=energy_kcal,
        energy_kj=energy_kj,
        sugars=sugars,
        protein=protein,
        fat=fat,
        saturated_fat=saturated_fat,
        carbohydrates=carbohydrates,
        fibre=fibre,
        sodium=sodium,
        salt=salt
    )
    
    nutrition = NutritionData(
        basis=basis,
        serving_size=raw_data.get("serving_size"),
        values=nutrient_values,
        provenance=Provenance.source if any(v is not None for v in nutrient_values.model_dump().values()) else Provenance.missing
    )
    
    # 3. Ingredients
    # Prefer English text if present
    ing_text = raw_data.get("ingredients_text_en") or raw_data.get("ingredients_text") or None
    lang = raw_data.get("lang") or ("en" if raw_data.get("ingredients_text_en") else None)
    
    items: List[str] = []
    
    # Helper to parse top-level comma separated items respecting parentheses
    def parse_text_items(text: str) -> List[str]:
        parsed = []
        current = []
        depth = 0
        for char in text:
            if char == "(":
                depth += 1
                current.append(char)
            elif char == ")":
                depth = max(0, depth - 1)
                current.append(char)
            elif (char == "," or char == ";") and depth == 0:
                piece = "".join(current).strip().strip(".").strip()
                if piece and len(piece) > 1:
                    parsed.append(piece)
                current = []
            else:
                current.append(char)
        if current:
            piece = "".join(current).strip().strip(".").strip()
            if piece and len(piece) > 1:
                parsed.append(piece)
        return parsed

    # If raw_data has structured ingredient items
    if "ingredients" in raw_data and isinstance(raw_data["ingredients"], list):
        for item in raw_data["ingredients"]:
            if isinstance(item, dict):
                # Prefer English taxonomy id if text is non-English or missing
                txt = item.get("text")
                item_id = str(item.get("id", ""))
                if raw_data.get("ingredients_text_en") and item_id.startswith("en:"):
                    clean_id = item_id.replace("en:", "").replace("-", " ").title()
                    items.append(clean_id)
                elif txt:
                    items.append(str(txt))

    # If structured items are still empty or fewer than parsed text, parse from English text
    if ing_text and (not items or (raw_data.get("ingredients_text_en") and len(items) <= 3)):
        parsed_from_text = parse_text_items(ing_text)
        if parsed_from_text:
            items = parsed_from_text

    ingredients = IngredientsData(
        raw_text=ing_text,
        items=items,
        language="en" if raw_data.get("ingredients_text_en") else lang,
        provenance=Provenance.source if ing_text else Provenance.missing
    )
    
    # 4. Allergens
    # Do NOT declare allergen-free.
    allergens_raw = raw_data.get("allergens", "")
    allergens_tags = raw_data.get("allergens_tags", [])
    
    allergens_list = []
    if allergens_tags and isinstance(allergens_tags, list):
        allergens_list = [t.replace("en:", "").replace("-", " ").title() for t in allergens_tags]
    elif allergens_raw and isinstance(allergens_raw, str):
        allergens_list = [a.strip().title() for a in allergens_raw.split(",") if a.strip()]
        
    traces_raw = raw_data.get("traces", "")
    traces_tags = raw_data.get("traces_tags", [])
    traces_list = []
    if traces_tags and isinstance(traces_tags, list):
        traces_list = [t.replace("en:", "").replace("-", " ").title() for t in traces_tags]
    elif traces_raw and isinstance(traces_raw, str):
        traces_list = [t.strip().title() for t in traces_raw.split(",") if t.strip()]
        
    has_allergens_data = bool(allergens_list or traces_list)
    allergens = AllergensData(
        declared=allergens_list,
        traces=traces_list,
        provenance=Provenance.source if has_allergens_data else Provenance.missing
    )
    
    # 5. Source
    last_mod_t = raw_data.get("last_modified_t")
    last_mod_iso = None
    if last_mod_t:
        try:
            last_mod_iso = datetime.fromtimestamp(int(last_mod_t), timezone.utc).isoformat()
        except (ValueError, TypeError):
            pass
            
    source = SourceData(
        api_version=api_version,
        product_url=f"https://world.openfoodfacts.org/product/{code}",
        last_modified=last_mod_iso,
        retrieved_at=datetime.now(timezone.utc).isoformat()
    )
    
    # 6. Completeness
    # Fraction of these key fields present: name, brand, ingredients text, energy, sugars, protein, fat, saturated fat, carbohydrates, fibre, sodium or salt, known basis
    key_fields_present = [
        bool(name),
        bool(brand),
        bool(ing_text),
        energy_kcal is not None or energy_kj is not None,
        sugars is not None,
        protein is not None,
        fat is not None,
        saturated_fat is not None,
        carbohydrates is not None,
        fibre is not None,
        sodium is not None or salt is not None,
        basis != NutritionBasis.unknown
    ]
    
    missing_fields = []
    if not name: missing_fields.append("name")
    if not brand: missing_fields.append("brand")
    if not ing_text: missing_fields.append("ingredients_text")
    if energy_kcal is None and energy_kj is None: missing_fields.append("energy")
    if sugars is None: missing_fields.append("sugars")
    if protein is None: missing_fields.append("protein")
    if fat is None: missing_fields.append("fat")
    if saturated_fat is None: missing_fields.append("saturated_fat")
    if carbohydrates is None: missing_fields.append("carbohydrates")
    if fibre is None: missing_fields.append("fibre")
    if sodium is None and salt is None: missing_fields.append("sodium_or_salt")
    if basis == NutritionBasis.unknown: missing_fields.append("nutrition_basis")
    
    completeness = CompletenessData(
        score=round(sum(key_fields_present) / len(key_fields_present), 2),
        missing=missing_fields
    )
    
    # 7. Source Computed Fields (OFF's own algorithms, isolated from Pinfo)
    source_computed = SourceComputedData(
        nutriscore=raw_data.get("nutriscore_grade"),
        nova_group=raw_data.get("nova_group"),
        additive_tags=raw_data.get("additives_tags", [])
    )
    
    return Product(
        ref=f"bc-{code}",
        kind="food",
        name=name,
        name_provenance=Provenance.source if name else Provenance.missing,
        brand=brand,
        brand_provenance=Provenance.source if brand else Provenance.missing,
        quantity=quantity,
        quantity_provenance=Provenance.source if quantity else Provenance.missing,
        image_url=image_url,
        image_provenance=Provenance.source if image_url else Provenance.missing,
        categories=categories,
        categories_provenance=Provenance.source if categories else Provenance.missing,
        ingredients=ingredients,
        nutrition=nutrition,
        allergens=allergens,
        source=source,
        completeness=completeness,
        source_computed=source_computed
    )
