# Test bank

Every automated test carries one ID from this bank in its title. `npm run test:bank` fails if a test has no bank entry or a bank entry has no test.

## How the suites are used

- **Regression** (`@regression`): behaviour that already works and must not break. Runs on every push and pull request.
- **Progression** (`@progression`): tests for capabilities added in the current release. They run on every push as well. When a release ships, its progression tests move to regression.
- **Negative** (`@negative`): invalid input, blocked actions, missing data and failure handling.
- **UI**, **UX** and **A11y** cases are tagged `@ui`, `@ux` and `@a11y` and sit inside the regression suite.

Pipeline order: lint and type check, test-bank check, unit and API tests, build of both services, end-to-end tests (feature, UI, UX, accessibility, service boundary), then production deploy of the API and the web UI only when every stage is green, then a smoke test on both live URLs with automatic rollback.

Totals: 207 cases. Unit 66, API 35, end-to-end 106. Regression 126, progression 34, negative 47.

## Unit tests: data, health model, alerts, route, filters, language

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-U-001 | Data | regression | DM-01 | Fleet has exactly 1,000 containers | Generate the fleet | Length is 1000 |
| TC-U-002 | Data | regression | DM-01 | Status split is 912 normal, 61 warning, 27 critical | Count containers by status | Counts match the deck and dashboard |
| TC-U-003 | Data | regression | FR-05 | Container IDs are unique and follow SC-#### format | Collect all IDs | 1000 unique IDs, all match the pattern |
| TC-U-004 | Data | regression | NFR-13 | Generation is deterministic | Generate the fleet twice | Both runs are deep-equal |
| TC-U-005 | Data | regression | FR-01 | Every position is inside Saudi Arabia and inside the map view | Check lat, lon and projected x, y | All within bounds |
| TC-U-006 | Data | regression | FR-06 | Readings are in valid ranges | Check battery, signal, health, humidity | 0 to 100 for battery, health and humidity; signal 0 to 5 |
| TC-U-007 | Data | regression | BR-12 | Twelve devices are offline with zero signal | Filter offline containers | 12 offline, signal 0, all normal status |
| TC-U-008 | Data | regression | FR-57 | Reefer set point lies inside the band, dry cargo has none | Check setpointC against the profile | Reefer within band, dry null |
| TC-U-009 | Data | regression | FR-17 | Gas modules only on gas-relevant cargo or the gas scenario | Check gas vs profile | No gas reading on other cargo |
| TC-U-010 | Data | regression | FR-47 | Rule engine agrees with status for all 1,000 containers | Evaluate alerts for each container | Normal has none, warning only warnings, critical at least one critical |
| TC-U-011 | Data | regression | FR-04 | Series has 289 samples at 5 minute steps ending now | Build a series | 289 samples, minAgo 1440 down to 0 |
| TC-U-012 | Data | regression | NFR-13 | Series is deterministic for a container | Build twice | Equal |
| TC-U-013 | Data | negative | FR-05 | getContainer returns undefined for unknown, null or empty IDs | Call with SC-0000, null, empty string | undefined each time, no throw |
| TC-U-014 | Data | negative | FR-05 | getSeries returns undefined for an unknown ID | Call with SC-0000 | undefined |
| TC-U-015 | Data | negative | NFR-13 | pick throws on an empty list | Call pick with [] | Throws |
| TC-U-016 | Data | regression | NFR-13 | range stays inside its bounds | Draw 1000 values | min <= v < max |
| TC-U-020 | Health | regression | FR-41 | No excursion scores 100 | Series fully inside band | Score 100, zero degree-hours |
| TC-U-021 | Health | regression | FR-41 | Score stays between 0 and 100 under extreme excursions | 60 degrees above band for 24 h | Score >= 0 and <= 100, finite |
| TC-U-022 | Health | regression | FR-42 | Longer or larger excursions never raise the score | Compare scores for increasing excursions | Score is non-increasing |
| TC-U-023 | Health | regression | FR-42 | Q10 weighting: the same degree-hours cost more at a higher excursion | Compare 2 C for 4 h with 4 C for 2 h | Second score is lower |
| TC-U-024 | Health | regression | FR-43 | Humidity outside the band lowers the score | Humidity 20 points out for 6 h | Score below 100 |
| TC-U-025 | Health | negative | FR-41 | Empty series returns a safe result | Call computeHealth with [] | Score 100, no NaN |
| TC-U-026 | Health | regression | FR-44 | Forecast detects a steady rise with an ETA inside 6 hours | Linear ramp towards the limit | ETA between 0 and 6, limit upper |
| TC-U-027 | Health | regression | FR-44 | Forecast returns no breach for a flat series | Constant temperature | etaH null |
| TC-U-028 | Health | negative | FR-44 | Forecast stays quiet when already outside the band | Last reading above the limit | etaH null |
| TC-U-029 | Health | negative | FR-44 | Forecast ignores compressor oscillation | Sine wave inside the band | etaH null |
| TC-U-030 | Health | negative | FR-44 | Forecast handles very short series | Pass 3 samples | etaH null, no throw |
| TC-U-031 | Health | regression | FR-44 | Forecast detects a fall toward the lower limit | Linear fall | limit lower, ETA within 6 h |
| TC-U-032 | Health | regression | FR-45 | Remaining shelf life scales with the score | Compare scores and shelf life | Lower score gives fewer hours, never above full shelf life |
| TC-U-033 | Health | regression | FR-46 | Top factors are complete and sorted | Call topFactors | Four factors, descending values |
| TC-U-040 | Alerts | regression | FR-47 | Temperature more than 3 C outside the band is critical | Last reading 3.5 C above limit | temperature_critical, critical |
| TC-U-041 | Alerts | regression | FR-47 | 20 minutes outside the band is critical | 4 samples just above the limit | temperature_critical |
| TC-U-042 | Alerts | negative | FR-47 | Readings inside the band raise no temperature alert | Series inside band | No temperature_critical |
| TC-U-043 | Alerts | regression | FR-58 | Reefer off its set point for 15 minutes is critical | 3 samples 2.5 C off set point | reefer_setpoint |
| TC-U-044 | Alerts | regression | FR-47 | Door open above 5 km/h is critical | Door open at 60 km/h | door_in_motion |
| TC-U-045 | Alerts | negative | FR-47 | Door open while stationary raises no door alert | Door open at 0 km/h | No door_in_motion |
| TC-U-046 | Alerts | regression | FR-36 | Ongoing unscheduled stop over 5 minutes is a warning | Stop away from approved points | unscheduled_stop, warning |
| TC-U-047 | Alerts | negative | FR-36 | A stop at an approved location is not alerted | Stop on an approved point | No unscheduled_stop |
| TC-U-048 | Alerts | regression | FR-38 | More than 2 km from the corridor is a warning | Position 6 km off corridor | route_deviation |
| TC-U-049 | Alerts | negative | FR-38 | 1 km from the corridor raises no deviation | Position 1 km off | No route_deviation |
| TC-U-050 | Alerts | regression | FR-19 | NH3 and H2S above thresholds are critical | NH3 30, H2S 12 | gas_high critical; below thresholds none |
| TC-U-051 | Alerts | progression | FR-31 | Custom thresholds change the outcome | Raise tempCriticalC to 10 | Previously critical case no longer fires |
| TC-U-052 | Alerts | regression | FR-45 | Forecast alert is a warning and is suppressed when a critical temperature alert exists | Rising series, then out-of-band series | health_forecast only in the first case |
| TC-U-053 | Alerts | regression | FR-47 | Severity map matches the BRD catalogue | Read SEVERITY | Four critical, three warning types |
| TC-U-060 | Geo | regression | FR-35 | Haversine distance Jeddah to Riyadh is about 840 km | Compute distance | Between 810 and 870 km |
| TC-U-061 | Geo | regression | FR-38 | Distance to corridor is 0 on the corridor and positive off it | Check points on and off | 0 on, positive off |
| TC-U-062 | Route | regression | FR-36 | A stop needs speed under 3 km/h for at least 5 minutes | Test 1-sample, 2.9 and 3.0 km/h cases | Boundaries respected |
| TC-U-063 | Route | regression | FR-37 | Stops within 3 km of approved points are scheduled | Classify stops | Origin, mid-route and destination stops are scheduled |
| TC-U-064 | Route | regression | FR-51 | Excursions are grouped with the correct peak | Two separate excursions | Two entries, correct peak and duration |
| TC-U-065 | Route | regression | FR-40 | ETA decreases with progress and is zero at the end | Compute ETA at 0.2, 0.5, 1 | Strictly decreasing, 0 at 1 |
| TC-U-066 | Geo | regression | FR-03 | Cities project inside the map view with correct relative positions | Project cities | Inside view, Jeddah west of Riyadh, Tabuk north of Jizan |
| TC-U-067 | Geo | negative | FR-35 | corridorPoint clamps t below 0 and above 1 | Call with -1 and 2 | Returns origin and destination |
| TC-U-068 | Route | regression | FR-35 | actualPath skips repeated positions | Samples with a stop | No duplicate path nodes |
| TC-U-070 | Filter | regression | FR-05 | Search matches ID, trip, plate, driver and customer | Search each field | Each returns its container |
| TC-U-071 | Filter | regression | FR-05 | Search ignores case and extra spaces | Search '  sc-1043 ' | Finds SC-1043 |
| TC-U-072 | Filter | regression | FR-05 | Status filter returns only that status | Filter critical | 27 containers |
| TC-U-073 | Filter | regression | FR-05 | Filters combine | Status + cargo + reefer | Intersection only |
| TC-U-074 | Filter | negative | FR-05 | Blank or whitespace query returns everything | Query '   ' | 1000 results |
| TC-U-075 | Filter | negative | FR-05 | A query with no match returns an empty list | Query 'zzzz' | [] |
| TC-U-076 | Filter | negative | FR-05 | Regex and markup characters are treated as plain text | Query '.*', '(', '<script>' | No throw, empty result |
| TC-U-077 | Filter | regression | FR-03 | countByStatus totals match | Count the fleet | 912, 61, 27, total 1000, offline 12 |
| TC-U-080 | i18n | regression | NFR-11 | English and Arabic dictionaries have identical keys | Compare key sets | Equal |
| TC-U-081 | i18n | regression | NFR-11 | No empty translations | Scan values | None empty |
| TC-U-082 | i18n | regression | NFR-11 | Placeholders match across languages | Compare {tokens} | Same set per key |
| TC-U-083 | i18n | regression | NFR-11 | translate substitutes parameters | Call with params | Tokens replaced |
| TC-U-084 | i18n | negative | NFR-11 | A missing parameter leaves the token visible | Call without params | Token kept, no throw |

## API service tests

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-A-001 | Health | regression | NFR-14 | Health returns ok with service name and version | GET /api/v1/health | 200, status ok, version 1.0.0 |
| TC-A-002 | Health | regression | NFR-14 | Health is never cached | Read Cache-Control | no-store |
| TC-A-003 | Docs | regression | NFR-14 | OpenAPI document describes every route | GET /api/v1/openapi | Six paths listed |
| TC-A-004 | Profiles | regression | DM-03 | Profiles lists the 7 cargo profiles | GET /api/v1/profiles | 7 profiles |
| TC-A-005 | Fleet | regression | DM-01 | Fleet returns 1,000 containers with 912 / 61 / 27 and 12 offline | GET /api/v1/fleet | Counts match |
| TC-A-006 | Fleet | regression | DM-01 | Fleet status filter returns only that status | status=critical | 27 containers, all critical |
| TC-A-007 | Fleet | regression | DM-01 | Fleet cargo and reefer filters combine | profile=dairy and reefer=true | Only dairy reefers |
| TC-A-008 | Fleet | regression | DM-01 | Fleet search by container ID finds exactly one | q=SC-1043 | One result |
| TC-A-009 | Fleet | regression | DM-01 | Fleet pagination returns the requested window | limit=5 and offset=10 | Containers 11 to 15, total 1000 |
| TC-A-010 | Container | regression | DM-02 | Container detail carries the analytics the UI needs | GET SC-1001 | Health, forecast, stops, deviation, excursions, alerts present |
| TC-A-011 | Container | regression | DM-04 | A temperature scenario container is outside its band with a low score | GET SC-1060 | Not within band, score under 80, temperature alert |
| TC-A-012 | Container | regression | DM-05 | A stop scenario container has exactly one unscheduled stop | GET SC-1075 | One unscheduled stop |
| TC-A-013 | Container | regression | DM-06 | A forecast scenario container has a predicted breach | GET SC-1007 | ETA within 6 hours |
| TC-A-014 | Series | regression | DM-02 | Series has 289 readings, oldest first, five minutes apart | GET SC-1060 series | 289 samples, 1440 to 0 minutes ago |
| TC-A-015 | Alerts | regression | DM-07 | Alerts returns 102 with critical first | GET /api/v1/alerts | 102 alerts, critical before warning |
| TC-A-016 | Alerts | regression | DM-07 | Alerts severity filter returns only warnings | severity=warning | 61 warnings |
| TC-A-017 | Alerts | regression | DM-09 | Alerts customer filter returns only that customer's containers | customer=Najd Fresh Foods | Only that customer's containers |
| TC-A-018 | Alerts | progression | DM-10 | Alerts threshold override recalculates the list | deviationKm=50 | Fewer alerts, default list unchanged |
| TC-A-019 | Fleet | regression | NFR-14 | The same request always returns the same data | Call twice | Identical bodies |
| TC-A-020 | CORS | regression | NFR-14 | CORS is open for GET and answers the preflight | GET and OPTIONS | Allow-Origin *, 204 on OPTIONS |
| TC-A-021 | Caching | regression | NFR-14 | Data endpoints are cacheable at the edge | Read Cache-Control | s-maxage present |
| TC-A-030 | Container | negative | DM-02 | Unknown container returns 404 with the error shape | GET SC-9999 | 404, code container_not_found, no-store |
| TC-A-031 | Series | negative | DM-02 | Unknown container series returns 404 | GET SC-9999 series | 404 |
| TC-A-032 | Routing | negative | NFR-14 | Unknown route returns 404 | GET /api/v1/nope | 404 not_found |
| TC-A-033 | Fleet | negative | DM-01 | Invalid status is rejected | status=bogus | 400 invalid_status |
| TC-A-034 | Fleet | negative | DM-01 | Invalid limit and offset are rejected | limit 0, -1, abc, 1001, 1.5; offset -3 | 400 each |
| TC-A-035 | Fleet | negative | DM-01 | Unknown cargo profile and bad reefer flag are rejected | profile=gold; reefer=maybe | 400 each |
| TC-A-036 | Alerts | negative | DM-10 | Invalid thresholds are rejected | 0, -5, abc, empty, NaN, Infinity | 400 invalid_threshold |
| TC-A-037 | Routing | negative | NFR-14 | Write methods return 405 with an Allow header | POST, PUT, PATCH, DELETE | 405, Allow lists GET |
| TC-A-038 | Alerts | negative | DM-07 | Invalid severity is rejected | severity=urgent | 400 invalid_severity |
| TC-A-039 | Container | negative | NFR-14 | Hostile container IDs return 404 or 400, never a server error | Path traversal, script tag, NUL, bad encoding, 5,000 characters | 400 or 404 |
| TC-A-040 | Routing | negative | NFR-14 | Garbage paths never produce a server error | Double slashes, extra segments, unknown version | Status below 500 |
| TC-A-050 | HTTP | regression | NFR-14 | Serves JSON with the right headers and status codes | Real HTTP socket | JSON content type, nosniff, 404 error body |
| TC-A-051 | HTTP | negative | NFR-14 | HEAD returns headers and no body | HEAD /api/v1/fleet | 200, empty body |
| TC-A-052 | HTTP | negative | NFR-14 | Malformed percent-encoding returns 400 instead of crashing | GET /containers/%E0%A4%A | 400, service still healthy |

## End-to-end: features (regression)

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-001 | Fleet | regression | DM-01 | Fleet KPIs show 1,000 / 912 / 61 / 27 | Open the home page | Four tiles with those numbers and 12 offline note |
| TC-E-002 | Fleet | regression | DM-01 | Map draws a dot for every container | Count map dots | 1000 dots |
| TC-E-003 | Fleet | regression | FR-05 | Clicking a status tile filters map and count | Click Critical | Showing 27 of 1,000, 27 dots, tile pressed |
| TC-E-004 | Fleet | regression | FR-05 | Search by container ID finds one container | Type SC-1043 | Showing 1 of 1,000 |
| TC-E-005 | Fleet | regression | FR-05 | Cargo and reefer filters combine | Pick Dairy and tick Reefer only | Only dairy containers shown |
| TC-E-006 | Fleet | regression | FR-26 | Selecting a dot opens a summary and links to detail | Click a dot, open | Selected card appears, detail page opens |
| TC-E-007 | Container | regression | DM-02 | Detail shows cargo card, readings, gauge and two charts | Open SC-1001 | All present, temperature within limits |
| TC-E-008 | Container | regression | DM-02 | Temperature outside the band is flagged | Open SC-1060 (temp scenario) | Tile reads Outside limits |
| TC-E-009 | Container | regression | DM-02 | Gas readings and set point appear when fitted | Open SC-1014 and SC-1159 | Gas tile on first, set point tile on second |
| TC-E-010 | Route | regression | DM-03 | Route page shows planned and actual paths and stops | Open SC-1075 | Two paths, four pins (origin hold, two approved stops, one unscheduled), one unscheduled row |
| TC-E-011 | Route | regression | DM-03 | Deviation distance is shown above 2 km | Open SC-1088 | Deviation value above 2 km |
| TC-E-012 | Health | regression | DM-04 | Early warning banner appears for a predicted breach | Open SC-1007 | Forecast banner visible |
| TC-E-013 | Health | regression | DM-04 | A temperature excursion lowers the gauge | Open SC-1060 | Score below 80, factors listed |
| TC-E-014 | Alerts | regression | DM-05 | Alerts centre lists 102 alerts, critical first | Open Alerts | 102 alerts, first row critical |
| TC-E-015 | Alerts | regression | DM-05 | Severity and state filters narrow the list | Pick Warning | Only warning rows |
| TC-E-016 | Alerts | regression | DM-05 | Alert search by container ID | Type SC-1014 | Only that container's alerts |
| TC-E-017 | Replay | regression | DM-06 | Scrubber moves the truck and the readout | Set slider to 0 then end | Time label and readout change |
| TC-E-018 | Report | regression | DM-08 | Report shows summary, chart, excursions and door log | Open SC-1060 report | Excursion table present, score shown |
| TC-E-019 | Report | regression | DM-08 | Report for a clean container says no excursions | Open SC-1001 report | No excursions message |
| TC-E-020 | Admin | regression | DM-09 | Admin shows profile library and device list | Open Admin | 7 profiles, 15 devices |
| TC-E-021 | Nav | regression | DM-02 | Container tabs navigate between views | Click each tab | Each page loads, current tab highlighted |
| TC-E-022 | Nav | regression | DM-01 | Main navigation reaches Fleet, Alerts and Admin | Click the links | Pages load, aria-current set |

## End-to-end: service boundary (web UI and API)

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-100 | Service | regression | NFR-14 | Fleet and alerts data come from the API service | Open the fleet page, watch requests | Requests go to the API origin |
| TC-E-101 | Service | regression | NFR-14 | A container page loads its detail and series from the API | Open SC-1060 | Detail and series requests sent to the API |
| TC-E-102 | Service | negative | NFR-15 | Fleet shows an error with Retry when the API is down, then recovers | Block the API, load, unblock, Retry | Error state, then 1,000 containers |
| TC-E-103 | Service | negative | NFR-15 | Alerts shows an error state when the API answers 500 | Stub a 500 on /alerts | Error state, no rows |
| TC-E-104 | Service | progression | NFR-15 | A slow API shows a loading state, then the data | Delay /fleet by 1.2 s | Loading state, then 1,000 containers |
| TC-E-105 | Service | progression | DM-10 | Changed thresholds are sent to the API as query parameters | Set deviation to 50 and save | Request carries deviationKm=50 |
| TC-E-106 | Service | negative | NFR-15 | An API outage on a container page shows an error, not Container not found | Block /containers, open SC-1060 | Error state, no not-found |
| TC-E-107 | Service | regression | NFR-14 | The API sends CORS headers so the UI can run on another origin | GET health with an Origin header | access-control-allow-origin * |

## End-to-end: progression (new in this release)

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-030 | Alerts | progression | FR-48 | Acknowledge then close moves an alert through its lifecycle | Ack, then close | State Open, Acknowledged, Closed |
| TC-E-031 | Alerts | progression | FR-49 | Escalation timer shows for critical open alerts | Open Alerts | Escalated or Escalates in N min on critical rows |
| TC-E-032 | Alerts | progression | NFR-13 | Alert state survives a reload | Ack, reload | Still Acknowledged |
| TC-E-033 | Replay | progression | DM-06 | Play advances the replay | Click Play | Time label changes without touching the slider |
| TC-E-034 | Modules | progression | DM-07 | Padlock lock and unlock with confirmation and audit entry | Unlock SC-1075, confirm | State Unlocked, audit entry appears |
| TC-E-035 | Modules | progression | FR-19 | Gas panel flags high NH3 and H2S | Open SC-1014 modules | Both bars marked high |
| TC-E-036 | Admin | progression | FR-31 | Raising a threshold recalculates alerts | Set deviation distance to 50 km, save | Alert total drops, reset restores 102 |
| TC-E-037 | Persona | progression | DM-10 | Customer view shows only that customer's 127 containers and hides Admin | Switch to Customer | 127 containers, no Admin link |
| TC-E-038 | Persona | progression | DM-10 | Quality view shows lowest cargo health panel | Switch to Quality manager | Health panel replaces alerts panel |
| TC-E-039 | Persona | progression | DM-10 | Security view shows door and lock watch | Switch to Security officer | Door panel visible with entries |
| TC-E-040 | i18n | progression | NFR-11 | Arabic switches text and sets right-to-left | Click AR | html dir rtl, Arabic heading |
| TC-E-041 | i18n | progression | NFR-11 | Language choice persists after reload | Click AR, reload | Still Arabic |
| TC-E-042 | Fleet | progression | DM-01 | Map zoom buttons change the view | Zoom in, out, reset | data-zoom 2, 1, 1 |
| TC-E-043 | Report | progression | DM-08 | Print button calls the browser print | Stub window.print, click | Called once |

## End-to-end: negative cases

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-050 | Container | negative | FR-05 | Unknown container ID shows a not-found state | Open /container/?id=SC-9999 | Not found alert and a link back |
| TC-E-051 | Container | negative | FR-05 | Missing ID shows not found on every container view | Open each view without id | Not found each time |
| TC-E-052 | Fleet | negative | FR-05 | No-match search shows an empty state and Clear recovers | Type zzzz, then Clear | Empty state, then 1,000 again |
| TC-E-053 | Fleet | negative | FR-05 | Special characters in search do not break the page | Type <script>, .*, ( | Page still works, empty state |
| TC-E-054 | Modules | negative | DM-07 | Unlock is blocked while the truck is moving | Unlock SC-1089 | Error message, no dialog, state unchanged |
| TC-E-055 | Modules | negative | DM-07 | Cancel in the confirm dialog changes nothing | Unlock SC-1075, cancel | State still Locked, no audit entry |
| TC-E-056 | Modules | negative | DM-07 | Containers without modules show not fitted | Open SC-1001 modules | Both not-fitted messages |
| TC-E-057 | Admin | negative | FR-31 | Invalid thresholds are rejected | Enter 0, -5, abc, empty | Error shown, alert total unchanged |
| TC-E-058 | Persona | negative | DM-10 | Customer cannot open another customer's container or Admin | Customer view, open SC-1043 and /admin | Not found and not available states |
| TC-E-059 | Alerts | negative | FR-48 | Close is disabled before acknowledge, Acknowledge disabled after | Inspect buttons | Correct enabled states |
| TC-E-060 | Platform | negative | NFR-13 | Corrupted saved state does not break the app | Write invalid JSON to storage, load | Fleet renders normally |
| TC-E-061 | Platform | negative | NFR-13 | Unknown URL shows the 404 page | Open /does-not-exist/ | Not found state, no crash |
| TC-E-062 | Alerts | negative | DM-05 | Alert search with no match shows an empty state | Type SC-0000 | Empty message |

## End-to-end: UI

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-070 | UI | regression | NFR-10 | No horizontal scroll at desktop, tablet and phone widths | Visit key pages at 1360, 768, 390 px | scrollWidth <= clientWidth |
| TC-E-071 | UI | regression | NFR-10 | Status tiles sit in one row on desktop and two rows on phone | Measure tile positions | One row at 1360, two rows at 390 |
| TC-E-072 | UI | regression | NFR-10 | Header stays visible while scrolling | Scroll fleet page | Header top is 0 |
| TC-E-073 | UI | regression | NFR-10 | Print layout hides navigation | Emulate print on the report | Header hidden, report visible |
| TC-E-074 | UI | regression | NFR-11 | Arabic layout mirrors the header | Switch to Arabic | Brand on the right, controls on the left |
| TC-E-075 | UI | regression | NFR-10 | Map keeps its aspect ratio and is visible | Measure map box | Width greater than height, inside viewport |

## End-to-end: UX

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-080 | UX | regression | NFR-12 | Skip link is first in the tab order and moves focus to main | Press Tab, Enter | Skip link focused, then main focused |
| TC-E-081 | UX | regression | NFR-12 | Status tiles work from the keyboard | Tab to Critical tile, press Enter | Filter applied |
| TC-E-082 | UX | regression | NFR-12 | Confirm dialog takes focus and Escape cancels | Open dialog, press Escape | Dialog closes, nothing sent |
| TC-E-083 | UX | regression | NFR-12 | Controls have visible labels or accessible names | Scan buttons, inputs and selects | Every control has a name |
| TC-E-084 | UX | regression | NFR-12 | Touch targets are at least 40 px | Measure buttons and tiles | Height >= 40 |
| TC-E-085 | UX | regression | NFR-12 | Status text is announced, not colour alone | Check pills and tiles | Text labels present with every colour |
| TC-E-086 | UX | regression | NFR-01 | Fleet page is usable within 3 seconds | Measure load to interactive | Under 3000 ms on the test runner |
| TC-E-087 | UX | regression | NFR-13 | No console errors across all pages | Visit every page, record errors | Zero errors |
| TC-E-088 | UX | regression | NFR-11 | Language switch updates the html lang attribute | Click AR then EN | lang ar, then en |

## End-to-end: accessibility

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-090 | A11y Fleet | regression | NFR-12 | Fleet has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-091 | A11y Alerts | regression | NFR-12 | Alerts has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-092 | A11y Container detail | regression | NFR-12 | Container detail has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-093 | A11y Route | regression | NFR-12 | Route has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-094 | A11y Cargo health | regression | NFR-12 | Cargo health has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-095 | A11y Replay | regression | NFR-12 | Replay has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-096 | A11y Modules | regression | NFR-12 | Modules has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-097 | A11y Report | regression | NFR-12 | Report has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-098 | A11y Admin | regression | NFR-12 | Admin has no serious or critical accessibility violations | Run axe (WCAG 2 A and AA) on the page | Zero serious or critical violations |
| TC-E-099 | A11y Fleet Arabic | regression | NFR-11 | Fleet in Arabic has no serious or critical accessibility violations | Switch to Arabic, run axe | Zero serious or critical violations |

## Post-deploy smoke tests

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-S-001 | Smoke | regression | NFR-13 | Production smoke: home page loads with 1,000 containers | Open production URL | KPI total 1,000, map dots rendered |
| TC-S-002 | Smoke | regression | NFR-13 | Production smoke: a container page and alerts load | Open /container/?id=SC-1060 and /alerts/ | Both render without errors |
| TC-S-003 | Smoke | regression | NFR-13 | Production smoke: the API service is healthy and serves the fleet | GET health and fleet on the API URL | Health ok, fleet total 1,000 |

## End-to-end tests: landing page and interactive dashboard

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-108 | Fleet | progression | DM-01 | Landing hero shows the headline, four live figures and three actions | Open the fleet page | Headline, four live figures and three actions are visible; one h1 |
| TC-E-109 | Fleet | progression | DM-01 | Review critical containers filters the fleet to the 27 critical ones | Click Review critical containers | Showing 27 of 1,000; critical tile pressed |
| TC-E-110 | Fleet | progression | DM-01 | The quick tour steps through five screens and finishes | Open the tour, press Next four times, then Finish | Steps 1 to 5 appear in order and the dialog closes |
| TC-E-111 | Fleet | negative | DM-01 | Closing the tour with Escape or the backdrop leaves the dashboard unchanged | Open the tour, press Escape; open again, click the backdrop | Dialog closes both ways; fleet stays 1,000 of 1,000 |
| TC-E-112 | Fleet | progression | DM-01 | The status tiles filter the fleet and toggle back | Click the Critical status tile twice | 27 of 1,000, then back to 1,000 of 1,000 |
| TC-E-113 | Fleet | progression | DM-01 | The cargo chart filters by cargo type | Click the Dairy bar in the cargo chart | 158 of 1,000 and the cargo filter shows Dairy |
| TC-E-114 | Fleet | progression | DM-01 | A corridor bar filters the fleet and its chip clears the filter | Click the busiest corridor, then its chip | Fleet narrows with a corridor chip; chip removes the filter |
| TC-E-115 | Fleet | progression | DM-01 | Table headers sort ascending, descending, then back to the original order | Click the Cargo health header three times | Ascending, descending, then original order |
| TC-E-116 | Fleet | progression | DM-01 | Show 12 more extends the table and Show fewer returns to 12 rows | Click Show 12 more, then Show fewer | 24 rows, then 12 rows |
| TC-E-117 | Fleet | progression | DM-01 | Hovering a map dot shows a tooltip with the container ID | Hover a critical dot on the map | Tooltip shows an SC-ID, route and reading |
| TC-E-118 | Fleet | progression | DM-01 | Critical containers pulse on the map | Count pulse rings, then filter to Normal | 1 to 27 rings, then none |
| TC-E-119 | Alerts | progression | DM-03 | The alerts page opens with a summary of open, critical, warning and handled alerts | Open the alerts page | Summary shows four counts including 102 open |
| TC-E-120 | Accessibility | regression | NFR-10 | Landing page and the quick tour have no serious accessibility violations | Run axe on the landing page and with the tour open | No serious or critical violations |
| TC-E-121 | Fleet | progression | NFR-11 | The landing hero switches to Arabic and right to left | Switch to Arabic on the landing page | Right to left, Arabic hero text and tour button |
| TC-E-122 | UI | regression | NFR-10 | The hero stacks into one column on a phone | Open the fleet at 390 px wide | Hero figures sit below the hero text |
| TC-E-123 | Fleet | negative | FR-05 | The customer view scopes the hero figures to that customer | Switch to the Customer view | Hero and counts show only that customer, not 1,000 |
| TC-E-124 | UI | progression | DM-01 | The hero shows a road scene with three trucks and an icon on each figure | Open the fleet page | Road scene with three trucks; each of the four figures has an icon |
| TC-E-125 | Fleet | progression | DM-01 | Selecting a container opens its live twin with a thermometer, gauges and a truck on the map | Click a dot on the map | Card shows the container, thermometer, five readings; a truck marks the container on the map |
| TC-E-126 | Fleet | progression | DM-03 | Alert types appear as icon tiles whose counts add up to the open alerts | Open the fleet page | Seven icon tiles whose counts total 102, matching the open alerts figure |
| TC-E-127 | UI | progression | DM-01 | Each table row shows a container icon and the map labels the seven cities | Open the fleet page | Container icon on each row; seven city labels on the map |
| TC-E-128 | Fleet | regression | NFR-10 | The landing page states each fact once, with no repeated status chart or event list | Open the fleet page | No status donut, no latest events list, no intro paragraph repeating the fleet size |
