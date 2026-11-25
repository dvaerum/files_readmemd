# ADR-0007: Zone-driven Base name response

Status: Accepted — follow-up to ADR-0004 and Phase 3 of `docs/improvements-plan.md`.

The Base name response was a literal `footer` branch in `ConfigController`, while the admin template duplicated one block per Zone. Add a response-semantics field to each Zone in `zones.json` and derive both admin rendering and the Base name response from that declaration. The four Zone spellings from ADR-0004 stay unchanged; this field removes the last literal Zone token from controller code so future reviews do not re-propose it.
