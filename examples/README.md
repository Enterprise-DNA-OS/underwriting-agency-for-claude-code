# Example files

`insly-policies.csv` is a made-up policy list in the shape an agency gets when it saves a policy report or its monthly risk bordereau as CSV. Insly does not publish its export layout, so the importer matches columns by name (Policy Number, Insured Name, Product or Class of Business, Broker, Inception Date, Expiry Date, Sum Insured, Gross Premium, GST, Status, State) and a `--map` file names any column it misses.

```bash
npm run agency -- import insly --policies=examples/insly-policies.csv --dry-run
```

The fourth row (Marine Cargo) has no matching product under any binder, so the import lists it and skips it: add the product with `add-product`, then run the import again.
