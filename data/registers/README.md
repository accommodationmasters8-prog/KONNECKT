# Registers, ready to import

Converted from `SCHOOL_INSTITUTION_ZONALWISE_AutoRecovered_.xlsx` — one file per
category, in the shape the importer reads.

| File | Rows | Where to upload it |
| --- | ---: | --- |
| `universities.csv` | 55 | Categories → Universities → *Add many universities at once* |
| `secondary-schools.csv` | 5,176 | Categories → Secondary schools |
| `primary-schools.csv` | 16,271 | Categories → Primary schools |

Each file has `name, branch, region, district, phone, email`. The category is
decided by the screen you upload from, so there is no category column — the
source workbook's own `CATEGORY` column held PUBLIC/PRIVATE and means something
else entirely.

Only 630 of the 21,502 rows carry a branch. The rest import with none and are
visible to HQ until somebody assigns one; branch and zone scope are both
derived from that column. Assigning it later is an ordinary edit.

Check the file before importing — the preview names every row it will skip and
why, and nothing is written until you press Import. The whole file lands
together or not at all.
