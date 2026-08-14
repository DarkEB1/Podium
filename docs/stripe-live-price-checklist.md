# Going live with the new prices (manual, Nicholas only)

Agents never create live-mode Stripe objects or change Production env vars. When ready:

1. In the Stripe Dashboard (LIVE mode), create three recurring GBP monthly prices under the Podium product:
   - Starter: £59.00 / month, metadata `tier = 1`
   - Growth: £149.00 / month, metadata `tier = 2`
   - Enterprise: £299.00 / month, metadata `tier = 3`
   The `tier` metadata is REQUIRED: the webhook reads `price.metadata.tier` to assign the plan.
2. Copy each live price id (`price_...`).
3. In Vercel > Project podium > Settings > Environment Variables > Production, set:
   - `STRIPE_PRICE_TIER_1` = live Starter price id
   - `STRIPE_PRICE_TIER_2` = live Growth price id
   - `STRIPE_PRICE_TIER_3` = live Enterprise price id
4. Redeploy production. Existing subscribers keep their current price until they change plans.
