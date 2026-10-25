# I Hate Trains v35 — station-data report (workstream: station-level transit data)

Retrieval date for every file below: **2026-10-25**. Every `stations/<city>.json`
carries `"updated": "2026-10-25"` and a `"source"` string, and `stations.js`
exposes `window.IHTStations.freshness(cityId)` so city screens can show
"Station data updated <date> · <source>" (null when nothing is loaded, so the
screen falls back honestly instead of inventing a label).

## Method (no invented data)

- GTFS-static feeds were downloaded and parsed (`stops.txt`, `routes.txt`,
  `trips.txt`, `stop_times.txt`; `shapes.txt` skipped). For each metro route the
  shipped list is the **longest full-length trip pattern** in the feed (longest
  across directions, except where a branch is shipped as its own line).
- Station names are the feed's official names. Only mechanical cleanup was
  applied: ALL-CAPS names title-cased. No renaming, no padding, no autocomplete.
- Chicago CTA trips are scheduled as round trips, so those lists are truncated
  at the first repeated station (one-way unique list). Madrid lines 6 and 12
  are loops, truncated the same way (28 unique stations each).
- London has no public GTFS, so its lists were assembled from the official
  Transport for London Unified API: RouteSequence segments chained at shared
  endpoints into the longest simple path per line (branch segments omitted,
  see gaps below).
- Toronto was converted from the already-verified `ttc.json` (names only, no
  coordinates).

## What shipped

| City file | Lines | Station entries | Source feed (full URL) |
|---|---|---|---|
| toronto.json | 5 | 117 | City of Toronto Open Data, TTC GTFS, via verified `ttc.json`: https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/7795b45e-e65a-4465-81fc-c36b9dfff169/resource/cfb6b2b8-6191-41e3-bda1-b175c51148cb/download/opendata_ttc_schedules.zip |
| london.json | 12 | 356 | Transport for London Unified API, Line Route Sequence: https://api.tfl.gov.uk/Line/{id}/Route/Sequence/{outbound,inbound} |
| newyork.json | 23 | 852 | MTA NYC Subway GTFS: http://web.mta.info/developers/data/nyct/subway/google_transit.zip |
| paris.json | 16 | 394 | IDFM GTFS via transport.data.gouv.fr (resource updated 2026-10-24): https://www.data.gouv.fr/api/1/datasets/r/413988ed-d340-467b-8be2-7b999fcd207a |
| rome.json | 4 | 92 | Roma Servizi per la Mobilita GTFS (ATAC network): https://romamobilita.it/sites/default/files/rome_static_gtfs.zip |
| milan.json | 5 | 123 | ATM GTFS via Comune di Milano open data, fetched through the Mobility Database mirror (agency URL https://dati.comune.milano.it/gtfs.zip returned an HTML bot page from this VM; mirror: https://storage.googleapis.com/storage/v1/b/mdb-latest/o/it-lombardia-milan-atm-gtfs-2666.zip?alt=media ; feed files dated 2026-05-08) |
| naples.json | 2 | 29 | ANM GTFS: http://www.anm.it/google/google-transit.zip |
| turin.json | 1 | 23 | GTT GTFS via Mobility Database mirror (agency URL https://www.gtt.to.it/open_data/gtt_gtfs.zip unreachable from this VM; mirror: https://storage.googleapis.com/storage/v1/b/mdb-latest/o/it-piedmont-turin-gruppo-torinese-trasporti-gtfs-2687.zip?alt=media ; feed files dated 2026-05-30) |
| boston.json | 8 | 169 | MBTA GTFS: https://cdn.mbta.com/MBTA_GTFS.zip |
| chicago.json | 9 | 212 | CTA GTFS: https://www.transitchicago.com/downloads/sch_data/google_transit.zip |
| sanfrancisco.json | 6 | 115 | BART GTFS: https://www.bart.gov/dev/schedules/google_transit.zip |
| montreal.json | 4 | 73 | STM GTFS: https://www.stm.info/sites/default/files/gtfs/gtfs_stm.zip (the plain `gtfs.zip` URL returned an HTML page; the `gtfs_stm.zip` variant worked) |
| berlin.json | 9 | 203 | VBB GTFS: https://unternehmen.vbb.de/fileadmin/user_upload/VBB/Dokumente/API-Datensaetze/gtfs-mastscharf/GTFS.zip |
| washingtondc.json | 6 | 149 | WMATA Metrorail GTFS via Mobility Database mirror (agency feed https://api.wmata.com/gtfs/rail-gtfs-static.zip requires an API key; mirror: https://storage.googleapis.com/storage/v1/b/mdb-latest/o/us-district-of-columbia-washington-wmata-gtfs-1847.zip?alt=media ; feed files dated 2024-10-01, the oldest snapshot in this batch; WMATA lines are unchanged since) |
| sydney.json | 1 | 31 | Transport for NSW GTFS (Greater Sydney bundle): https://opendata.transport.nsw.gov.au/data/dataset/d1f68d4f-b778-44df-9823-cf2fa922e47f/resource/67974f14-01bf-47b7-bfa5-c7f2f8a950ca/download/full_greater_sydney_gtfs_static_0.zip |
| saopaulo.json | 6 | 94 | SPTrans GTFS: https://www.sptrans.com.br/umbraco/Surface/PerfilDesenvolvedor/BaixarGTFS?memberName=sptrans |
| amsterdam.json | 5 | 76 | OVapi Netherlands GTFS (GVB routes): https://gtfs.ovapi.nl/nl/gtfs-nl.zip |
| madrid.json | 12 | 250 | Metro de Madrid GTFS via CRTM ArcGIS open data: https://crtm.maps.arcgis.com/sharing/rest/content/items/5c7f2951962540d69ffe8f640d94c246/data |

Totals: 18 city files, 134 lines, 3,358 station entries.

## Files changed in this copy (nothing else touched)

- `stations/*.json` (18 files, new) — contract shape
  `{"city","updated","source","lines":[{"id","name","color","stations":[...]}]}`.
- `stations.js` (new) — `window.IHTStations = { load(cityId) -> Promise<data|null>,
  get(cityId), has(cityId), format(data), freshness(cityIdOrData) }`, fetches
  `stations/<cityId>.json`, memory cache only, null on any failure.
- `metros.js` (edited) — every city now carries `stations: true`; 10 new cities
  added (boston, chicago, sanfrancisco, montreal, berlin, washingtondc, sydney,
  saopaulo, amsterdam, madrid); Paris gained M3bis (`m3b`) and M7bis (`m7b`);
  Rome gained Line B1 (`b1`). Line ids in every stations file match metros.js
  exactly. `app.js`, `index.html`, `styles.css`, `sw.js` are byte-identical to
  the original, and the original `~/workspace/i-hate-trains/` was never written to.

## Verification performed

- Every stations file parses as JSON; every line has >= 2 stations and no
  duplicate consecutive stations; station counts were sanity-checked against
  the real line (see gaps for the exceptions).
- Cross-check: every line id in every stations file exists in metros.js, and
  every metros.js city has a stations file. Only two metros.js lines have no
  station list (see "stays on manual fallback").
- `node --check` passes on `stations.js` and `metros.js`.
- Loader test (node, stubbed fetch): `load()` resolves real data for all 18
  cities, `freshness()` returns the "Station data updated …" string for each,
  and `load('atlantis')` resolves to `null` (manual fallback path).

## Known gaps: shipped but partial (ride-setup builder: these lines need the manual fallback offered alongside)

- **London**: longest through-route per line only. Omitted branches: Central
  Ealing Broadway branch (Ealing Broadway, West Acton); District Wimbledon /
  Richmond / Kensington Olympia / Edgware Road branches; Metropolitan Chesham /
  Watford / Uxbridge branches; Northern Edgware and Battersea branches plus one
  of the two central routes (Bank vs Charing Cross); Piccadilly Heathrow branch;
  Elizabeth Heathrow and Abbey Wood branches. Circle is the full 36-station loop.
- **New York**: longest pattern per service. Branch variants omitted (e.g. A
  Lefferts Blvd branch; the shipped A pattern is the Far Rockaway pattern).
  `S` is the 42 St Shuttle only (Franklin Av and Rockaway Park shuttles are not
  separate lines). 6X/7X express variants are not separate lines. Note: MTA
  reuses names for distinct stations ("7 Av" in Brooklyn and Manhattan, "36 St"
  in Brooklyn and Queens), so those names legitimately appear twice in the B
  and R lists.
- **Paris**: M7 ships the Mairie d'Ivry pattern (Villejuif branch omitted);
  M13 ships the Saint-Denis pattern (Asnieres-Gennevilliers branch omitted).
  M10's one-way Auteuil loop is merged from both directions into a single
  23-station list (dir1 order with the Boulogne-bound-only loop stations
  Porte d'Auteuil, Michel-Ange - Auteuil, Eglise d'Auteuil inserted after
  Boulogne Jean Jaures) — order around the loop is a merge, not a single
  scheduled direction.
- **Boston**: Red Line ships Alewife–Braintree; the Ashmont branch (JFK/UMass,
  Savin Hill, Fields Corner, Shawmut, Ashmont) is not in the list.
- **Milan**: M1 ships the Rho Fieramilano pattern (Bisceglie branch omitted);
  M2 ships the Assago–Gessate pattern (Cologno Nord branch omitted). ATM feed
  names keep their abbreviations/suffixes verbatim (e.g. "P.Ta Venezia",
  "Cadorna Fn M1").
- **Madrid**: this CRTM feed snapshot is itself partial. Line 3 is absent from
  the feed entirely (no stations). Line 7 ends at Estadio Metropolitano (the
  eastern leg to Hospital del Henares has zero trips in the feed). Line 9 ends
  at Puerta de Arganda (Rivas/Arganda del Rey section has zero trips). Line 10
  starts at Tres Olivos (the northern Hospital Infanta Sofia section has zero
  trips). Lines 6 and 12 are loops truncated to 28 unique stations. Madrid R
  color is the feed's `#FFFFFF` (white).
- **Berlin**: U6 ships Kurt-Schumacher-Platz–Alt-Mariendorf; the northern leg
  (Alt-Tegel, Borsigwerke, Holzhauser Str., Otisstr., Scharnweberstr.) runs as
  rail-replacement bus in this feed and is not in the rail list. U12 (part-time
  combined U1/U2 service) omitted.
- **Montreal**: names keep the feed's "Station " prefix verbatim (e.g. "Station
  Angrignon"); the Blue line extension to Anjou is not in the feed.
- **Turin**: names keep the feed's "Metro " prefix verbatim (e.g. "Metro Fermi").
- **Naples**: L2 (suburban rail) is present in the ANM feed but excluded — it is
  not a metros.js metro line. Feed name "S. Rosa" kept verbatim.
- **Sao Paulo**: CPTM commuter-rail lines (7–13) excluded. Lines 6 and 17
  (under construction) appear in the feed but were excluded as not in service.
- **Sydney**: Metro M1 only; Sydney Trains suburban lines excluded (not metro).
- **Washington DC**: snapshot dated 2024-10-01 (see source row); re-verify
  before any future refresh claims current data.

## Stays on manual fallback (NOT done, reported honestly)

- **Naples Line 11 (Rainbow, EAV)**: not present in the ANM feed. metros.js
  still lists `l11`; it has no entry in `naples.json` and must use manual entry.
- **Madrid Line 3**: absent from the CRTM feed. metros.js lists it (for manual
  fallback); it has no entry in `madrid.json`.
- **Vancouver**: NOT DONE. TransLink's GTFS host
  (`https://gtfs.translink.ca/static/latest/google_transit.zip`) failed to
  connect from this VM, and the Transitland/Mobility Database APIs require an
  API key. No file shipped; no stations invented.
- **Singapore**: NOT DONE. The only keyless feed found (a community GitHub
  mirror of LTA data) is incomplete: every NS trip carries only 16 of the 27
  stations, so it was rejected rather than shipped partial. LTA DataMall
  requires an API key. No file shipped.
- **Mumbai**: theme-only as before (no metros.js entry, no stations file).
- Every other city in metros.js now has a stations file; every other line in
  those files is a verified feed list subject to the partial-line notes above.
