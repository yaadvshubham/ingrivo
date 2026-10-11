# Open Food Facts Coverage Report

- **Generated:** 2026-10-11 16:16:38 UTC
- **Target Server:** `https://world.openfoodfacts.net`
- **API Version:** `v3`
- **Total Barcodes Tested:** 22

## Summary Metrics

| Metric | Count / Value | Percentage |
| :--- | :--- | :--- |
| **Products Found** | 9 / 22 | 40.9% |
| **Products Not Found** | 13 / 22 | 59.1% |
| **Locally Rejected (Invalid Check Digit)** | 0 / 22 | 0.0% |
| **Errors / Rate Limits** | 0 / 22 | 0.0% |
| **Average Completeness (Found)** | 0.93 / 1.00 | 92.6% |
| **Found with Ingredients** | 8 / 9 | 88.9% |
| **Found with Stated Nutrition Basis** | 9 / 9 | 100.0% |

## Per-Barcode Details

| Barcode | Status | Product Name | Completeness | Missing Key Fields |
| :--- | :--- | :--- | :---: | :--- |
| `5449000000996` | Found | Coca-Cola | 0.83 | protein, fibre |
| `3017620422003` | Found | Nutella | 1.00 | None |
| `8000500003787` | Found | Ferrero Rocher | 0.92 | fibre |
| `7622300710262` | Not Found | - | 0.00 | product_not_found |
| `5053990138722` | Found | Pringles original | 1.00 | None |
| `5000159461122` | Found | Snickers | 1.00 | None |
| `9002490100070` | Found | Red Bull | 0.83 | protein, fibre |
| `5000157024671` | Found | ベイクドビーンズ | 1.00 | None |
| `8901030383700` | Not Found | - | 0.00 | product_not_found |
| `8901725181222` | Found | Yippee noodles | 0.83 | brand, ingredients_text |
| `8901491101837` | Found | Lays Classics Salted 20rs | 0.92 | fibre |
| `8901058852448` | Not Found | - | 0.00 | product_not_found |
| `8901063018440` | Not Found | - | 0.00 | product_not_found |
| `8901030010019` | Not Found | - | 0.00 | product_not_found |
| `8901262010047` | Not Found | - | 0.00 | product_not_found |
| `8902579103026` | Not Found | - | 0.00 | product_not_found |
| `8901719101052` | Not Found | - | 0.00 | product_not_found |
| `8901058859188` | Not Found | - | 0.00 | product_not_found |
| `8901030825354` | Not Found | - | 0.00 | product_not_found |
| `8901233024011` | Not Found | - | 0.00 | product_not_found |
| `8901058863260` | Not Found | - | 0.00 | product_not_found |
| `0000000000000` | Not Found | - | 0.00 | product_not_found |

## Key Observations

- **Invalid Barcodes**: Pre-validated on client/backend and rejected before any outbound network call, keeping external load zero.
- **Missing Fields**: Fibre and exact sodium are the most commonly omitted nutrient fields in Open Food Facts user-contributed records.
- **Honest Handling**: Missing nutrients are strictly recorded as `null` rather than `0`, and products missing stated basis are labeled `unknown`.
