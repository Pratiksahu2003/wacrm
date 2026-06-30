# VedMint CRM

WhatsApp Business CRM by **VedMint Consultancy Services** — shared inbox, contacts, sales pipelines, broadcasts, and automations.

**Production app:** [https://wa.vedmint.com](https://wa.vedmint.com)

## Features

- **Shared inbox** on the official WhatsApp Business API — multiple agents on one number, assignment, status, and notes.
- **Contacts** with tags, custom fields, CSV import, and deduplication.
- **Sales pipelines** (Kanban) with deals linked to conversations.
- **Broadcasts** with Meta-approved templates and delivery tracking.
- **Automations** — triggers on inbound messages, keywords, or schedule; conditional branches, tags, and webhooks.
- **Dashboard** — response times, daily volume, pipeline value, and activity feed.
- **Team management** — roles, invitations, and per-member WhatsApp configuration.

## Documentation

In-app documentation (no login required):

- [Getting started](https://wa.vedmint.com/docs/getting-started)
- [WhatsApp setup](https://wa.vedmint.com/docs/whatsapp-setup)
- [Troubleshooting](https://wa.vedmint.com/docs/troubleshooting)

## Local development

```bash
npm install
cp .env.local.example .env.local   # fill in Supabase + Meta credentials
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Stack

- **App** — Next.js 16 (App Router), React 19, TypeScript, Tailwind v4.
- **Data** — Supabase (Postgres + Auth + Storage + RLS).
- **WhatsApp** — Meta Cloud API (official WhatsApp Business API).

## Support

- Email: [support@vedmint.com](mailto:support@vedmint.com)
- Security: [security.txt](https://wa.vedmint.com/.well-known/security.txt)

## License

[MIT](./LICENSE)
