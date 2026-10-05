# Test bank

Every automated test carries one ID from this bank in its title. `npm run test:bank` fails if a test has no bank entry or a bank entry has no test.

## How the suites are used

- **Regression** (`@regression`): behaviour that already works and must not break. Runs on every push and pull request.
- **Progression** (`@progression`): tests for capabilities added in the current release. They run on every push as well. When a release ships, its progression tests move to regression.
- **Negative** (`@negative`): invalid input, blocked actions, missing data and failure handling.
- **UI**, **UX** and **A11y** cases are tagged `@ui`, `@ux` and `@a11y` and sit inside the regression suite.

Pipeline order: lint and type check, test-bank check, unit and API tests, build of both services, end-to-end tests (feature, UI, UX, accessibility, service boundary), then production deploy of the API and the web UI only when every stage is green, then a smoke test on both live URLs with automatic rollback.

Totals: 315 cases. Unit 104, API 35, end-to-end 176. Regression 196, progression 53, negative 66.

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
| TC-E-030 | Alerts | progression | FR-48 | An alert moves through acknowledge, in progress, resolved and closed | Open Alerts, acknowledge the first alert, start work, resolve it, then close it | The state reads Open, Acknowledged, In progress, Resolved and finally Closed |
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
| TC-E-059 | Alerts | negative | FR-48 | Close is disabled until the alert is resolved, Acknowledge disabled after it is done | Open Alerts and look at the first alert, then acknowledge it | Close is disabled before and after acknowledging, and Acknowledge is disabled after |
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

## Unit tests: alert and alarm management (ITSM), journey planning and on-boarding

Priority matrix, SLA clocks, support tiers, problem candidates, the route and pitstop planner, milestone tracking and on-boarding checks.

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-U-090 | ITSM | regression | FR-59 | the priority matrix gives P1 for high impact and urgency and P4 for the lowest | Read the priority matrix | P1 for high impact and urgency, P4 for the lowest |
| TC-U-091 | ITSM | regression | FR-59 | impact and urgency follow the alert type, cargo and age | Classify alerts by type, cargo and age | Impact, urgency and priority follow the rules |
| TC-U-092 | ITSM | regression | FR-59 | response and resolution targets get longer as priority drops | Compare targets from P1 to P4 | Response and resolution targets grow as priority drops |
| TC-U-093 | ITSM | regression | FR-59 | an open alert breaches its response clock once its age reaches the target | Run the response clock on an open P1 alert at 5, 8 and 10 minutes | Running, at risk, then breached |
| TC-U-094 | ITSM | regression | FR-59 | acknowledging stops the response clock and resolving stops the resolution clock | Stop the clocks by acknowledging and resolving | Response and resolution stop at the action, and late actions read met late |
| TC-U-095 | ITSM | regression | FR-59 | breaches and major incidents lift the support tier | Work out the tier for fresh, breached and major tickets | L1 by default, L2 for P1 or response breach, L3 for resolution breach or major incident |
| TC-U-096 | ITSM | regression | FR-59 | the lifecycle only allows the next step and closure needs a resolution | Check every allowed and refused state change | Only the next step is allowed and closure needs a resolution |
| TC-U-097 | ITSM | regression | FR-59 | statistics count active tickets, SLA risk, owners and mean times | Compute statistics for the 102 alerts and for a closed ticket | Totals, owners, matrix cells and mean times are right |
| TC-U-098 | ITSM | regression | FR-59 | recurring alerts on one corridor become problem candidates | Group the alerts by type and corridor | Patterns of four or more alerts become problem candidates, largest first |
| TC-U-099 | ITSM | regression | FR-59 | queues order by priority, then by the oldest alert | Sort two tickets and format minutes | Priority first, then oldest, and durations read 45 min, 2 h 5 min, 2 h |
| TC-U-100 | Journeys | regression | FR-60 | times are read and written as plain local time | Parse and print local times | Round trip works and invalid dates are rejected |
| TC-U-101 | Journeys | negative | FR-60 | a plan is rejected for the same city, repeated stops, a bad time or a bad speed | Validate plans with bad cities, times and speeds | Each problem is named and planning throws |
| TC-U-102 | Journeys | regression | FR-60 | a short trip has loading, departure, arrival and delivery and no pitstop | Plan a short trip | Loading, departure, arrival and delivery with no pitstop |
| TC-U-103 | Journeys | regression | FR-60 | long trips get rest stops after 4.5 hours of driving and fuel stops by range | Plan Jeddah to Riyadh | Rest stops within 4.5 hours of driving and fuel stops within range |
| TC-U-104 | Journeys | regression | FR-60 | milestones stay in time order with growing distance and a daily driving limit adds an overnight stop | Plan Dammam to Jeddah | Milestones in time and distance order, with an overnight stop and a multi-day warning |
| TC-U-105 | Journeys | regression | FR-60 | via cities become waypoints and the road is the sum of the legs | Plan with a via city | Waypoint milestone and legs that add up to the total |
| TC-U-106 | Journeys | regression | FR-60 | reefer cargo adds a pre-trip temperature check and port cities add gate and customs steps | Plan reefer cargo from a port with customs | Pre-trip check, port gate, customs and a long haul warning |
| TC-U-107 | Journeys | regression | FR-60 | a deadline that the plan cannot meet raises a warning | Plan with a tight deadline and a late night start | Deadline and night departure warnings |
| TC-U-108 | Journeys | progression | FR-60 | a new journey is planned and completing milestones moves it to dispatched, in transit and completed | Complete every milestone of a new journey | Status goes planned, dispatched, in transit, completed |
| TC-U-109 | Journeys | progression | FR-60 | delays are measured against the plan and move the estimated arrival | Log milestones with delays | Delay, estimated arrival, late flag and the delayed status follow |
| TC-U-110 | Journeys | negative | FR-60 | only rest and fuel stops can be skipped and a completed journey cannot be cancelled | Skip and cancel at the wrong time | Only rest and fuel stops can be skipped and a completed journey cannot be cancelled |
| TC-U-111 | Journeys | regression | FR-60 | a fleet trip can be replayed up to its progress and the position follows the road | Replay a fleet trip at half way | In transit, with progress and position along the road |
| TC-U-112 | On-boarding | regression | FR-61 | a complete form passes | Validate a complete form | No errors |
| TC-U-113 | On-boarding | negative | FR-61 | bad container IDs, plates, seals and phone numbers are named | Validate bad IDs, plates, seals, phones and duplicates | Each problem is named |
| TC-U-114 | On-boarding | negative | FR-61 | reefer cargo needs a set point inside its band and dry cargo does not | Validate reefer set points and dry cargo | Missing and out of band set points are refused, dry cargo needs none |
| TC-U-115 | On-boarding | regression | FR-61 | journey IDs continue from the highest one in use | Create journey IDs and build a journey from a form | IDs continue from the highest and values are normalised |
| TC-U-116 | Journeys | regression | FR-60 | every container in the fleet has a journey, with a matching status and progress | Seed journeys from the live fleet | 1,000 journeys, one per container, 997 on the road, two planned, one completed and the offline devices delayed |

## End-to-end: alert and alarm management (ITSM)

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-129 | Alerts | regression | FR-59 | The service level strip shows breaches, risk, unassigned, major incidents and mean times | Open Alerts | Six service level figures show, 102 unassigned and at least one breached |
| TC-E-130 | Alerts | regression | FR-59 | The priority matrix counts every open alert once and a cell filters the queue | Add the nine matrix cells, select the first | Cells total 102 and the list shows only P1 alerts |
| TC-E-131 | Alerts | regression | FR-59 | Every alert shows a priority badge, response and resolution clocks, a tier and an owner | Read the first alert row | Priority, response and resolution clocks, tier, owner and kind are shown on all 102 |
| TC-E-132 | Alerts | progression | FR-59 | Acknowledging stops the response clock and keeps the resolution clock running | Acknowledge the first alert | The response clock stops as met late and resolution keeps running |
| TC-E-133 | Alerts | progression | FR-59 | A ticket goes through acknowledge, start, resolve with a code and close, and the timeline records each step | Acknowledge, start, resolve with a code and close | Each state shows and the timeline has four entries |
| TC-E-134 | Alerts | progression | FR-59 | Assigning an owner moves the ticket from Unassigned into My queue | Assign the first alert to yourself | My queue becomes 1 and Unassigned drops to 101 |
| TC-E-135 | Alerts | progression | FR-59 | Escalating lifts the tier and declaring a major incident moves the ticket to the duty manager | Escalate a P4 alert and declare a major incident | Tier goes L1, L2, L3 and the major incident count is 1 |
| TC-E-136 | Alerts | progression | FR-59 | A note added to a ticket appears in its timeline | Add a note to a ticket | The note appears in the timeline and the field clears |
| TC-E-137 | Alerts | progression | FR-59 | Recurring alerts become problem candidates and raising one links the alerts to a problem record | Raise a problem from a candidate with a root cause | PRB-001 appears, linked alerts show it and it survives a reload |
| TC-E-138 | Alerts | negative | FR-59 | Resolve and Close stay disabled until the earlier steps are done | Check the buttons before and after acknowledging | Start, Resolve and Close are disabled until their earlier step is done |
| TC-E-139 | Alerts | negative | FR-59 | A blank note cannot be added | Add an empty or blank note | The Add button stays disabled |
| TC-E-140 | Alerts | negative | FR-59 | The customer view has no service desk panels and no action buttons | Switch to the customer view on Alerts | No service level strip, matrix, problems or action buttons |
| TC-E-141 | Alerts | regression | FR-59 | The lifecycle and tier tiles count the tickets and filter the list | Use the lifecycle and tier tiles | Counts match and selecting a tile filters the list |
| TC-E-142 | Alerts | progression | FR-59 | Owner, notes and state survive a reload | Assign, acknowledge and reload | Owner, state and timeline are kept |
| TC-E-143 | A11y Alerts | regression | NFR-12 | The alert and alarm page with an open ticket has no serious accessibility violations @regression @a11y | Open a ticket and run the accessibility scan | No serious or critical violations |
| TC-E-144 | Alerts | regression | NFR-13 | The alert and alarm page works in Arabic with the service level strip and queues | Switch the Alerts page to Arabic | Arabic headings, queues and clocks with no serious violations |
| TC-E-145 | Alerts | regression | NFR-11 | The alert and alarm page fits a phone without sideways scrolling | Open Alerts and a ticket at 390 px | No sideways scrolling |

## End-to-end: journey operations, on-boarding and theme

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-E-146 | Operations | regression | FR-60 | The Operations page puts all 1,000 containers on a journey board with a count for each status | Open Operations from the menu, then show all in transit journeys | 1,000 journeys: Planned 2, In transit 926, Delayed 71, Completed 1, and each column lists only 12 cards until Show all |
| TC-E-147 | Operations | regression | FR-60 | Searching the board by container, journey or customer narrows the cards | Search the board | Cards narrow and an empty state shows for no match |
| TC-E-148 | Operations | regression | FR-60 | A journey page shows the road, load details, key figures and the milestone list | Open a journey | Road, load details, key figures and milestones from loading to delivery |
| TC-E-149 | Operations | progression | FR-60 | Logging the next milestone with a delay updates the delay, the estimated arrival and the row | Log milestones with a 20 minute delay and reload | Status, delay and estimated arrival update and persist |
| TC-E-150 | Operations | progression | FR-60 | A delay of more than 30 minutes marks the journey Delayed and it moves to the Delayed column | Log a 45 minute delay | The journey is Delayed and sits in the Delayed column |
| TC-E-151 | Operations | progression | FR-60 | A rest or fuel stop can be skipped and is shown as skipped | Skip the fuel stop | The stop is marked skipped and the next milestone moves on |
| TC-E-152 | Operations | progression | FR-60 | Cancelling a journey asks first and then marks it cancelled | Cancel a journey, first keep it, then confirm | The journey is cancelled and logging is gone |
| TC-E-153 | On-boarding | progression | FR-61 | A new load can be on-boarded, planned and dispatched in five steps, and it stays after a reload | Fill the five steps and dispatch | J-2001 is created, listed with its assets and kept after a reload |
| TC-E-154 | On-boarding | negative | FR-61 | The first step names what is missing and does not move on | Press Next on the empty first step | The missing fields are named and the step stays |
| TC-E-155 | On-boarding | negative | FR-61 | A container ID or plate that is already in use is refused | Use a container ID and a plate that exist | Both are refused as already in use |
| TC-E-156 | On-boarding | negative | FR-61 | A set point outside the cargo's safe band is refused | Enter a set point of 14 for dairy | The set point is refused until it is back in band |
| TC-E-157 | On-boarding | negative | FR-60 | A route with the same start and end, or a bad speed, is refused | Choose the same start and end, then a speed of 20 | Both are refused with a clear message |
| TC-E-158 | Operations | negative | FR-60 | A delay that is not a number logs nothing and shows an error | Log an empty delay and a delay of 5000 | An error shows and nothing is logged |
| TC-E-159 | Operations | negative | FR-60 | An unknown journey ID and the customer view both get a clear block | Open J-9999 and open Operations as a customer | Not found and not available messages, no menu entry for the customer |
| TC-E-160 | Operations | regression | FR-60 | A long haul gets rest, fuel and overnight stops and a multi-day warning | Plan Dammam to Jeddah | Rest, fuel and overnight stops, pins on the map and a multi-day warning |
| TC-E-161 | Operations | regression | FR-60 | Stops on the way become waypoints in order and can be removed | Add and remove stops on the way | Waypoints keep their order and the plan shows Madinah |
| TC-E-162 | Operations | regression | FR-60 | A port destination offers customs clearance and adds that milestone | Plan Riyadh to Dammam with customs | Customs and the pre-trip check appear in the milestones |
| TC-E-163 | Operations | regression | FR-60 | A delivery deadline that the plan misses raises a warning | Set a deadline the plan cannot meet | A deadline warning shows |
| TC-E-164 | A11y Operations | regression | NFR-12 | Operations pages have no serious accessibility violations @regression @a11y | Scan the board, assets, a journey and the plan step | No serious or critical violations |
| TC-E-165 | Operations | regression | NFR-13 | Operations work in Arabic with right to left layout | Switch Operations to Arabic | Arabic labels, right to left layout and Arabic error text |
| TC-E-166 | Operations | regression | NFR-11 | Operations pages fit a phone without sideways scrolling | Open the three Operations pages at 390 px | No sideways scrolling |
| TC-E-167 | UI | regression | NFR-10 | The theme is a soft grey-blue canvas with a dark navy sidebar, a white top bar and an indigo accent | Read the theme tokens, the sidebar and the top bar colours | Grey-blue background, indigo accent, dark sidebar, white top bar and the hero gradient, with no old navy, blue or sand |

## Analytics, reports and persona dashboards

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-U-117 | Analytics | regression | FR-67 | a customer is scoped to its own containers and everyone else sees the whole fleet | Scope the fleet, alerts and journeys for each persona | Operator and quality see 1,000 containers, a customer sees only its own, with matching alerts and journeys |
| TC-U-118 | Analytics | regression | FR-65 | each persona gets its own four KPIs and widget set | Compute the analytics for every persona | Four unique KPI ids per persona, the widget list of that persona, finite values |
| TC-U-119 | Analytics | regression | FR-65 | the analytics numbers add up to the scope they were computed for | Sum the status, health, cargo, lock and delay series | Every series adds up to the containers or journeys in scope |
| TC-U-120 | Analytics | regression | FR-65 | quality sees only quality alert types and security only security types | Count open alerts by type for both personas | Only the types of that persona, three security types listed |
| TC-U-121 | Analytics | regression | FR-65 | delay bands and ETA buckets cover every value once | Bucket edge delays and the customer journeys | Edges fall in the right band and the arrival buckets add up to all journeys |
| TC-U-122 | Reports | regression | FR-66 | every report in the catalogue builds with rows that match its columns, and only for the personas that own it | Build every report for every persona | Row and total widths match the columns, a customer has no operator or security report, totals equal 1,000 |
| TC-U-123 | Reports | regression | FR-66 | CSV export quotes commas and quotes, neutralises formulas and starts with a byte order mark | Export a table with commas, quotes, a formula and a line break | Cells are quoted, the formula is prefixed, a BOM leads and lines end in CRLF |
| TC-E-168 | Analytics | regression | FR-65 | Analytics opens for the operator with journey, corridor and service desk widgets | Open Analytics as the operator | Four operator KPIs, five widgets, 997 journeys on the road and 71 delayed |
| TC-E-169 | Analytics | regression | FR-65 | Analytics changes its KPIs and widgets with the persona | Switch through all four personas on Analytics | Each persona shows its own KPIs and widgets and none of the others |
| TC-E-170 | Analytics | regression | FR-67 | A customer sees only its own containers in analytics and reports | Open Analytics and Reports as the customer | Scope names the customer, fewer than 1,000 containers, no service desk, no operator or security reports, no other customer rows |
| TC-E-171 | Dashboard | regression | FR-67 | The dashboard strip adapts to the persona and links to analytics and reports | Switch personas on the Fleet page and follow the links | Strip KPIs, side panel and alert types follow the persona and the links keep the persona |
| TC-E-172 | Navigation | regression | FR-65 | The sidebar lists Analytics and Reports for every persona and marks the current one | Check the sidebar for each persona and open Reports | Both links for all personas, Reports marked current and Fleet not |
| TC-E-173 | Reports | regression | FR-66 | Each persona gets its own report catalogue and the report body follows the pick | Open Reports for each persona and pick a report | Catalogue per persona, the first report opens by default, the body follows the pick |
| TC-E-174 | Reports | regression | FR-66 | The daily operations report totals match the fleet and can be filtered by cargo and text | Read the totals, filter by text and by cargo | 1,000 containers in the total row, text filter hides the total, cargo filter shows 158 dairy |
| TC-E-175 | Reports | regression | FR-66 | A report exports to a CSV file that matches the table | Export the daily operations report | A CSV with a BOM, the table header, eight rows and a total row |
| TC-E-176 | Reports | progression | FR-66 | A report with no matching rows says so, and long reports page in steps | Page through journey on-time performance and search for nothing | 25 rows, 50 after Show more, an empty message and no Show more for no match |
| TC-E-177 | A11y Analytics | regression | NFR-12 | Analytics and reports have no serious accessibility violations for any persona | Scan Analytics, Reports and the Fleet strip for all personas | No serious or critical violations |
| TC-E-178 | Analytics | regression | FR-65 | Analytics and reports work in Arabic with right to left layout | Switch to Arabic on Analytics, Reports and Fleet | Arabic headings, columns and strip, right to left layout |
| TC-E-179 | Analytics | regression | NFR-11 | Analytics, reports and every persona dashboard fit a phone without sideways scrolling | Open the three pages at 390 px for all personas | No sideways scrolling |
| TC-E-180 | Analytics | negative | FR-67 | Switching persona on a page never leaves another persona's report or widgets behind | Pick an operator report, switch to customer, open Analytics | The customer lands on its own report and sees no service desk or corridor widgets |

## Live map, road routing and route planner

| ID | Area | Suite | Ref | Case | Steps | Expected result |
|---|---|---|---|---|---|---|
| TC-U-124 | Live map | regression | FR-68 | a road is measured, split by share and sliced without losing its end points | Measure a three-point road, read points at shares below 0, at 0, 0.5, 1 and above 1, and slice it | Length matches the sum of legs, shares are clamped, slices end exactly at the share |
| TC-U-125 | Live map | regression | FR-68 | the heading follows the direction of the road and a truck advances with speed and time | Read bearings on an eastbound and a northbound leg, advance a truck by speed and simulated time | East is 90 degrees, north is 0, 80 km/h for an hour on 800 km adds 0.1, stopped trucks stay put, share never passes 1 |
| TC-U-126 | Live map | regression | FR-68 | the routing service answer is read safely and a bad answer gives no route | Parse a good answer, one with unusable routes and eight kinds of bad input, and build the request URL | Only usable routes are returned with km and minutes, bad input gives an empty list, the URL carries the stops in order |
| TC-U-127 | Live map | regression | FR-68 | every corridor has a local stand-in road, so tracking still works when routing is down | Build the stand-in road for all eight corridors and for a two-stop trip | Each has more than ten points and over 100 km, bounds are ordered, the estimate is flagged and over 900 km for Jeddah to Riyadh |
| TC-E-181 | Live map | regression | FR-68 | The live map opens with the whole fleet on a MapLibre map for the operator | Open the live map as the operator | A MapLibre canvas, 1,000 container points, seven city labels, the Live badge, the plan tab and a map credit |
| TC-E-182 | Live map | regression | FR-68 | Selecting a container draws its road, the truck and both ends, with speed and arrival | Open the live map with SC-1002 selected | Two road lines, one truck, two end pins, road source from the routing service, speed, distance left and arrival time |
| TC-E-183 | Live map | progression | FR-69 | Moving trucks advance along the road on the live clock | Select a moving truck and wait | The truck position changes and the distance still to drive falls |
| TC-E-184 | Live map | progression | FR-69 | Pausing the live clock stops the trucks and resuming moves them again | Pause, wait 4.5 s, resume | The truck stays put while paused, the badge says Paused, and it moves again after resuming |
| TC-E-185 | Live map | regression | FR-68 | The status filter and the search narrow the points and the list | Filter to critical, then search by ID and by a missing word | 27 critical points, 8 list rows, one match for SC-1002, an empty state and zero points for no match |
| TC-E-186 | Live map | regression | FR-70 | The live map follows the signed-in role: a customer sees only its own containers and no planner | Switch between operator, customer and quality | 1,000 containers for operator and quality, 127 for the customer, no planner tab for the customer |
| TC-E-187 | Live map | regression | FR-68 | The container and journey pages link to the live map with the container already selected | Click Track on the live map from a container and from a journey | The live map opens with that container selected |
| TC-E-188 | Live map | negative | FR-68 | When the routing service is down the map falls back to the planned corridor and says so | Block the routing service and open a container | Road source says estimate, the line, the truck and the arrival time still show |
| TC-E-189 | Live map | negative | FR-71 | A routing answer with no road is treated like an outage and the page still works | Answer the routing service with no route, then open the planner | Tracking and planning use the estimate, the planner shows the estimate note and a distance |
| TC-E-190 | Live map | negative | FR-68 | When the base map cannot load, routes and trucks are still drawn on a plain background | Block the base map style | Base map is offline, the notice shows, 1,000 points, two lines and the truck are drawn |
| TC-E-191 | Live map | progression | FR-71 | The route planner shows the road, distance, driving time, arrival, options and stops | Open the planner with the default Jeddah to Riyadh trip | Distance between 900 and 1,500 km, driving time, arrival, two route options, at least three stops, pins equal to stops |
| TC-E-192 | Live map | progression | FR-71 | Changing the speed, the option or the stops re-plans the route | Lower the speed, pick the second option, add Madinah as a stop | Driving time grows, the longer option adds distance, the summary lists the three cities |
| TC-E-193 | Live map | negative | FR-71 | The route planner refuses a trip that cannot be planned and says why | Pick the same city twice, repeat a stop, enter 20 km/h, clear the origin | Each case shows its own message and no summary until fixed |
| TC-E-194 | Live map | negative | FR-70 | A customer who opens the planner link still gets tracking only | Open the planner link and another container as a customer | The tracking view opens, no planner, and a container outside the customer's scope is not selected |
| TC-E-195 | Live map | regression | FR-68 | The live map works in Arabic with right to left layout and Arabic city names | Switch to Arabic and open the planner | Arabic heading, rtl direction, Arabic labels and no sideways scroll |
| TC-E-196 | Live map | regression | FR-68 | The live map and the route planner have no serious accessibility violations | Run the accessibility scan for every role, the planner and its error state | No serious or critical violations |
| TC-E-197 | Live map | regression | FR-68 | The live map fits desktop, tablet and phone without sideways scrolling and keeps 40 px controls | Open at 1360, 768 and 390 px wide | No horizontal scroll, a map taller than 300 px and controls at least 40 px tall |
| TC-E-198 | Live map | regression | FR-68 | Clicking a container on the map selects it | Filter to critical containers and click a rendered point | The side panel opens for the container that was clicked |
