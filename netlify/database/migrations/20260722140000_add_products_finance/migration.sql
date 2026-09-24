-- Adds a cutting-edge Finance & Investing line to the catalog. This opens a
-- brand-new "finance" niche and spans all four product categories — agents,
-- automations, prompt packs, and doc templates — so every one of them is
-- immediately runnable in the browser through the "use it as an app" engine
-- (netlify/functions/run-product + netlify/lib/product-app), which the buyer
-- unlocks the moment they purchase.
--
-- Like the earlier waves this is a roll-forward migration: it never touches an
-- existing seed, it only inserts new SKUs. ON CONFLICT (sku) DO NOTHING keeps it
-- idempotent and lets it coexist with the founding catalog, waves two–four, and
-- any products owners listed themselves.
INSERT INTO products (sku, name, category, niche, format, price, blurb, spec) VALUES
  -- Agents — the flagship, most "cutting edge" finance tools
  ('AI-AG-055', 'Portfolio Rebalancing Analyst', 'agents', 'finance', 'Agent config + drift rules', 44, 'Reads your holdings and target allocation, then tells you exactly what to buy and sell to get back on track.', 'Drift bands + tax-lot aware'),
  ('AI-AG-056', 'Earnings Call Copilot', 'agents', 'finance', 'Agent config + transcript loader', 46, 'Turns a raw earnings transcript into the thesis, the risks, and the three numbers that actually moved the stock.', 'Guidance + sentiment + KPI extraction'),
  ('AI-AG-057', 'Personal CFO Agent', 'agents', 'finance', 'Agent config + monthly review', 39, 'A standing agent that reviews your spending, spots the leaks, and gives you three moves to hit your savings goal.', 'Cashflow + goal tracking'),
  ('AI-AG-058', 'DCF Valuation Agent', 'agents', 'finance', 'Agent config + model presets', 49, 'Feed it the fundamentals and it builds a discounted-cash-flow valuation with a bull, base, and bear case.', 'Sensitivity table + WACC presets'),
  -- Automations
  ('AI-AB-059', 'Receipt-to-Ledger Automation', 'automations', 'finance', 'Zapier blueprint', 29, 'Turns a photo or PDF of a receipt into a categorized, tax-ready ledger entry — no manual typing.', 'OCR + tax-category mapping'),
  ('AI-AB-060', 'Cashflow Forecast Automation', 'automations', 'finance', 'Make.com blueprint', 33, 'Pulls your invoices and bills and projects a 13-week cashflow so you see the crunch before it hits.', '13-week rolling forecast'),
  -- Prompt packs
  ('AI-PP-061', 'Financial Modeling Prompt Pack', 'prompts', 'finance', '50 prompts · PDF + Sheets', 26, 'Build three-statement models, unit economics, and scenario analyses without staring at a blank spreadsheet.', 'Excel + Google Sheets formulas'),
  ('AI-PP-062', 'Equity Research Prompt Pack', 'prompts', 'finance', '45 prompts · PDF', 24, 'Structured prompts that turn a 10-K into an investment thesis with catalysts, risks, and a price target.', '10-K / 10-Q teardown workflow'),
  -- Doc templates
  ('AI-TP-063', 'Investor-Ready Financials Template', 'templates', 'finance', 'Sheets + Notion template', 22, 'The revenue, burn, and runway model investors expect — filled in from your numbers, not a blank tab.', 'P&L + burn + runway + cap table'),
  ('AI-TP-064', 'Personal Budget & Net-Worth Template', 'templates', 'finance', 'Sheets template', 15, 'Track every account, bill, and goal in one place, with a net-worth line that updates as you go.', '50/30/20 + net-worth tracker')
ON CONFLICT (sku) DO NOTHING;
