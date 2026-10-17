# Dear Amalia: Firside theme

Shopify Online Store 2.0 theme for the Dear Amalia Christmas store.

This is version **1.0.5 (details fix)**: theme 1.0.4 plus a fix so the "Details" table on product pages no longer scrolls sideways.

## What is in here

The 98 files of the theme, exactly as stored in Shopify (each file was checked against Shopify's own checksum).

| Folder | Holds |
| --- | --- |
| `assets/` | Styles (`theme-base.css`, `theme-pages.css`), script (`theme.js`), self-hosted fonts, illustrations |
| `config/` | Theme settings and their schema |
| `layout/` | `theme.liquid` and the password page layout |
| `locales/` | English (default) and Portuguese (Portugal) texts |
| `sections/` | Page sections, including the product page (`main-product.liquid`) |
| `snippets/` | Reusable pieces (product accordion, prices, cards, icons) |
| `templates/` | JSON templates for each page type |

## Product page metafields

Namespace `custom`, set on each product:

| Key | Shows |
| --- | --- |
| `subtitle` | One line under the title and on product cards |
| `details` | "Label: value" lines, shown as a table in the "Details" accordion (right below the description) |
| `highlights` | Short bullet points under the price |
| `badge` | Small tag on product cards |
| `gpsr_*` | EU product safety fields (manufacturer, responsible person, identifier, warnings) |

## Change in 1.0.5

`snippets/product-accordion.liquid` now ends with a `{% stylesheet %}` block. The details table had a minimum width of 480 px, wider than the product page's buying column, so it scrolled sideways even with nothing to scroll to. The block lets the table fit its column.

## How to use it

1. Zip the contents of this folder (the `assets`, `config`, `layout`... folders at the top level of the zip, not inside another folder).
2. In Shopify: Online Store > Themes > Add theme > Upload zip file.
3. Preview it, then publish.

Or with the Shopify CLI: `shopify theme push --unpublished`.

Fonts: Bricolage Grotesque and Geist, with their licences in `assets/fonts-licence-*.txt`.
