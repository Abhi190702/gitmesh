> **Historical plan.** Superseded by `IMPLEMENTATION.md` for current
> GitMesh Agents context. The ClipHub concept now ships under the name
> "Project Templates" inside GitMesh Agents.

# Project Templates Marketplace &mdash; Plan

A marketplace for whole-project AI-team configurations. Users buy a
blueprint and get a working GitMesh org &mdash; agents, reporting chains,
governance, and skills &mdash; in one click.

---

## At a glance

| Dimension | Value |
|-----------|-------|
| Working name | ClipHub |
| Unit of sale | Team blueprint (multi-agent org) |
| Buyer | Founder / team lead spinning up an AI project |
| Install target | A GitMesh Agents project |
| Value prop | "Skip org design &mdash; get a shipping team in minutes" |
| Price range | $0&ndash;$499 per blueprint, plus individual add-ons |

The marketplace ships four product kinds, scaling from full team
blueprints (the headline product) down to portable individual skills.

---

## 1. Product taxonomy

### 1.1 Team Blueprint &mdash; the headline product

A complete GitMesh project configuration in one bundle. It contains:

- **Org chart** &mdash; agents with roles, titles, reporting chains, capabilities;
- **Agent configs** &mdash; adapter type, model, prompt templates, instruction-file paths;
- **Governance rules** &mdash; approval flows, budget limits, escalation chains;
- **Project templates** &mdash; pre-configured projects with workspace settings;
- **Skills & instructions** &mdash; `AGENTS.md` and skill files bundled per agent.

Examples:

| Blueprint | Roles | Price |
|-----------|-------|-------|
| SaaS Startup Team | CEO, CTO, Engineer, CMO, Designer | $199 |
| Content Agency | Editor-in-Chief, 3 Writers, SEO Analyst, Social Manager | $149 |
| Dev Shop | CTO, 2 Engineers, QA, DevOps | $99 |
| Solo Founder + Crew | CEO + 3 ICs across eng / marketing / ops | $79 |

### 1.2 Agent Blueprint &mdash; one agent at a time

A single-agent configuration designed to slot into an existing GitMesh
org. Carries role definition, prompt template, adapter config, expected
reporting chain, skill bundles, governance defaults (budget,
permissions).

| Blueprint | Specialism | Price |
|-----------|-----------|-------|
| Staff Engineer | Production code, PR management | $29 |
| Growth Marketer | Content pipeline, SEO, social | $39 |
| DevOps Agent | CI/CD, deployment, monitoring | $29 |

### 1.3 Skill &mdash; modular capabilities

Portable skill files any GitMesh agent can use. Markdown skill files +
tool configs / shell scripts, compatible with GitMesh's skill loading.

| Skill | Scope | Price |
|-------|-------|-------|
| Git PR Workflow | Standardised PR creation + review | Free |
| Deployment Pipeline | Cloudflare / Vercel deploy | $9 |
| Customer Support Triage | Ticket classification + routing | $19 |

### 1.4 Governance Templates

Pre-built approval flows and policies: budget thresholds + approval
chains, cross-team delegation rules, escalation procedures, billing
code structures.

| Template | Posture | Price |
|----------|---------|-------|
| Startup Governance | Lightweight; CEO approves > $50 | Free |
| Enterprise Governance | Multi-tier approval, audit trail | $49 |

---

## 2. Data shapes

### 2.1 `Listing`

```typescript
interface Listing {
  id: string;
  slug: string;                    // URL-friendly identifier
  type: 'team_blueprint' | 'agent_blueprint' | 'skill' | 'governance_template';
  title: string;
  tagline: string;                 // ≤120 chars
  description: string;             // Markdown

  // Pricing
  price: number;                   // Cents (0 = free)
  currency: 'usd';

  // Creator
  creatorId: string;
  creatorName: string;
  creatorAvatar: string | null;

  // Categorisation
  categories: string[];
  tags: string[];
  agentCount: number | null;       // For team blueprints

  // Content
  previewImages: string[];
  readmeMarkdown: string;
  includedFiles: string[];

  // Compatibility
  compatibleAdapters: string[];
  requiredModels: string[];
  gitmesh-agentsVersionMin: string;

  // Social proof
  installCount: number;
  rating: number | null;           // 1.0–5.0
  reviewCount: number;

  // Metadata
  version: string;                 // Semver
  publishedAt: string;
  updatedAt: string;
  status: 'draft' | 'published' | 'archived';
}
```

### 2.2 `TeamBlueprint`

```typescript
interface TeamBlueprint {
  listingId: string;

  agents: AgentBlueprint[];
  reportingChain: { agentSlug: string; reportsTo: string | null }[];

  governance: {
    approvalRules: ApprovalRule[];
    budgetDefaults: { role: string; monthlyCents: number }[];
    escalationChain: string[];     // Agent slugs in escalation order
  };

  projects: ProjectTemplate[];

  projectDefaults: {
    name: string;
    defaultModel: string;
    defaultAdapter: string;
  };
}

interface AgentBlueprint {
  slug: string;                    // e.g. 'cto', 'engineer-1'
  name: string;
  role: string;
  title: string;
  icon: string;
  capabilities: string;
  promptTemplate: string;
  adapterType: string;
  adapterConfig: Record<string, any>;
  instructionsPath: string | null;
  skills: SkillBundle[];
  budgetMonthlyCents: number;
  permissions: {
    canCreateAgents: boolean;
    canApproveHires: boolean;
  };
}

interface ProjectTemplate {
  name: string;
  description: string;
  workspace: { cwd: string | null; repoUrl: string | null } | null;
}

interface ApprovalRule {
  trigger: string;                 // e.g. 'enable_agent', 'budget_exceed'
  threshold: number | null;
  approverRole: string;
}
```

### 2.3 `Creator`

```typescript
interface Creator {
  id: string;
  userId: string;                  // Auth provider id
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  website: string | null;
  listings: string[];
  totalInstalls: number;
  totalRevenue: number;            // Cents
  joinedAt: string;
  verified: boolean;
  payoutMethod: 'stripe_connect';
  stripeAccountId: string | null;
}
```

### 2.4 `Purchase` and `Review`

```typescript
interface Purchase {
  id: string;
  listingId: string;
  buyerUserId: string;
  buyerProjectId: string | null;
  pricePaidCents: number;
  paymentIntentId: string | null;
  installedAt: string | null;
  status: 'pending' | 'completed' | 'refunded';
  createdAt: string;
}

interface Review {
  id: string;
  listingId: string;
  authorUserId: string;
  authorDisplayName: string;
  rating: number;                  // 1–5
  title: string;
  body: string;
  verifiedPurchase: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## 3. Routes

### 3.1 Public pages

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Homepage | Hero, featured blueprints, popular skills, how-it-works |
| `/browse` | Marketplace browse | Filterable grid of all listings |
| `/browse?type=team_blueprint` | Team blueprints | Filtered to team configs |
| `/browse?type=agent_blueprint` | Agent blueprints | Single-agent configs |
| `/browse?type=skill` | Skills | Skill listings |
| `/browse?type=governance_template` | Governance | Policy templates |
| `/listings/:slug` | Listing detail | Full product page |
| `/creators/:slug` | Creator profile | Bio, all listings, stats |
| `/about` | About | Mission, how it works |
| `/pricing` | Pricing & fees | Creator revenue share, buyer info |

### 3.2 Authenticated pages

| Route | Page | Purpose |
|-------|------|---------|
| `/dashboard` | Buyer dashboard | Purchases + installed blueprints |
| `/dashboard/purchases` | Purchase history | All transactions |
| `/dashboard/installs` | Installations | Deployed blueprints with status |
| `/creator` | Creator dashboard | Listing management + analytics |
| `/creator/listings/new` | Create listing | Multi-step listing wizard |
| `/creator/listings/:id/edit` | Edit listing | Modify existing listing |
| `/creator/analytics` | Analytics | Revenue, installs, views |
| `/creator/payouts` | Payouts | Stripe Connect payout history |

### 3.3 API

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/listings` | Browse listings (filters: type, category, price range, sort) |
| GET | `/api/listings/:slug` | Listing detail |
| POST | `/api/listings` | Create listing (creator auth) |
| PATCH | `/api/listings/:id` | Update listing |
| DELETE | `/api/listings/:id` | Archive listing |
| POST | `/api/listings/:id/purchase` | Purchase (Stripe checkout) |
| POST | `/api/listings/:id/install` | Install to GitMesh project |
| GET | `/api/listings/:id/reviews` | Reviews list |
| POST | `/api/listings/:id/reviews` | Submit review |
| GET | `/api/creators/:slug` | Creator profile |
| GET | `/api/creators/me` | Current creator profile |
| POST | `/api/creators` | Register as creator |
| GET | `/api/purchases` | Buyer's purchase history |
| GET | `/api/analytics` | Creator analytics |

---

## 4. User flows

### 4.1 Buyer &mdash; browse, purchase, install

The buyer arrives at the homepage, browses or filters by type / category,
clicks a listing, reviews details and reviews and the org-chart preview,
and clicks `Buy` (or `Install` for free items). Stripe checkout completes
the transaction. The post-purchase view offers `Install to Project`. The
buyer picks a target GitMesh project (or creates a new one). ClipHub then
calls the GitMesh API to:

1. Create agents with configs from the blueprint.
2. Set up reporting chains.
3. Create projects with workspace configs.
4. Apply governance rules.
5. Deploy skill files to agent instruction paths.

The buyer is redirected to the GitMesh dashboard with a working team.

### 4.2 Creator &mdash; build, publish, earn

The creator signs up, connects Stripe, and runs the New Listing wizard:

1. Type (team / agent / skill / governance).
2. Basic info (title, tagline, description, categories).
3. Upload bundle (JSON config + skill files + README).
4. Preview + org-chart visualisation.
5. Pricing ($0&ndash;$499).
6. Publish.

The listing goes live immediately. The creator dashboard tracks
installs, revenue, and reviews.

### 4.3 Creator &mdash; export from GitMesh, then publish

A running GitMesh project can use `Export as Blueprint` (CLI or UI). The
exporter pulls sanitised agent configs (no secrets), the org chart and
reporting chains, governance rules, project templates, and playbook
files. The bundle is then uploaded to ClipHub as a new listing where the
creator edits details, sets a price, and publishes.

---

## 5. UI direction

### 5.1 Visual language

- Colour palette &mdash; dark ink primary, warm sand backgrounds, accent for CTAs (GitMesh brand blue/purple).
- Typography &mdash; clean sans-serif with strong hierarchy; monospace for technical detail.
- Cards &mdash; rounded corners, subtle shadows, clear pricing badges.
- Org-chart visuals &mdash; interactive tree / graph showing agent relationships.

### 5.2 Key elements

| Element | Treatment |
|---------|-----------|
| Product card | Org-chart mini-preview + agent count badge |
| Detail page | Interactive org chart + per-agent breakdown |
| Install flow | One-click deploy to GitMesh project |
| Social proof | "X projects running this blueprint" |
| Preview | Live demo sandbox (stretch milestone) |

### 5.3 Listing card mock

```
┌─────────────────────────────────────┐
│  [Org Chart Mini-Preview]           │
│  ┌─CEO─┐                            │
│  ├─CTO─┤                            │
│  └─ENG──┘                           │
│                                     │
│  SaaS Startup Team                  │
│  "Ship your MVP with a 5-agent      │
│   engineering + marketing team"     │
│                                     │
│  👥 5 agents  ⬇ 234 installs        │
│  ★ 4.7 (12 reviews)                 │
│                                     │
│  By @masinov          $199  [Buy]   │
└─────────────────────────────────────┘
```

### 5.4 Detail-page sections

1. Hero &mdash; title, tagline, price, install button, creator info.
2. Org chart &mdash; interactive visualisation of the agent hierarchy.
3. Agent breakdown &mdash; expandable cards for each agent (role, capabilities, model, skills).
4. Governance &mdash; approval flows, budget structure, escalation chain.
5. Included projects &mdash; project templates with workspace configs.
6. README &mdash; full markdown documentation.
7. Reviews &mdash; star ratings + written reviews.
8. Related blueprints &mdash; cross-sell similar team configs.
9. Creator profile &mdash; mini bio + other listings.

---

## 6. Installation mechanics

### 6.1 Install API

When the buyer clicks `Install to Project`:

```
POST /api/listings/:id/install
{
  "targetProjectId": "uuid",         // Existing GitMesh project
  "overrides": {                      // Optional customisation
    "agentModel": "claude-sonnet-4-6", // Override default model
    "budgetScale": 0.5,               // Scale budgets
    "skipProjects": false
  }
}
```

The install handler:

1. Validates the buyer owns the purchase.
2. Validates target project access.
3. For each agent in the blueprint, calls `POST /api/projects/:id/agents` (if `gitmesh-agents-create-agent` supports it; otherwise via approval flow). Sets adapter config, prompt template, instructions path.
4. Sets reporting chains.
5. Creates projects and workspaces.
6. Applies governance rules.
7. Deploys skill files to configured paths.
8. Returns a summary of created resources.

### 6.2 Conflict handling

| Conflict | Resolution |
|----------|-----------|
| Agent name collision | Append `-2`, `-3` suffix |
| Project name collision | Prompt buyer to rename or skip |
| Adapter mismatch | Warn if blueprint requires an adapter not available locally |
| Model availability | Warn if a required model is not configured |

---

## 7. Revenue model

| Fee | Amount | Notes |
|-----|--------|-------|
| Creator revenue share | 90% of sale price | Minus Stripe processing (~2.9% + $0.30) |
| Platform fee | 10% of sale price | ClipHub's cut |
| Free listings | $0 | No fees |
| Stripe Connect | Standard | Handled by Stripe |

---

## 8. Technical architecture

### 8.1 Stack

- Frontend &mdash; Next.js (React), Tailwind CSS, same UI framework as GitMesh Agents.
- Backend &mdash; Node.js API, or extend the GitMesh server.
- Database &mdash; Postgres; can share GitMesh's DB or run separately.
- Payments &mdash; Stripe Connect (marketplace mode).
- Storage &mdash; S3 / R2 for listing bundles and images.
- Auth &mdash; shared with GitMesh auth, or OAuth2.

### 8.2 Integration shape

Two options:

- **Option A** &mdash; A separate app that calls the GitMesh API to install blueprints.
- **Option B** &mdash; A built-in section of the GitMesh UI (`/marketplace` route).

For MVP, Option B is simpler &mdash; routes added to the existing GitMesh
UI and API.

### 8.3 Bundle format

ZIP / tar archive:

```
blueprint/
├── manifest.json          # Listing metadata + agent configs
├── README.md              # Documentation
├── org-chart.json         # Agent hierarchy
├── governance.json        # Approval rules, budgets
├── agents/
│   ├── ceo/
│   │   ├── prompt.md      # Prompt template
│   │   ├── AGENTS.md      # Instructions
│   │   └── playbooks/     # Playbook files
│   ├── cto/
│   │   ├── prompt.md
│   │   ├── AGENTS.md
│   │   └── playbooks/
│   └── engineer/
│       ├── prompt.md
│       ├── AGENTS.md
│       └── playbooks/
└── projects/
    └── default/
        └── workspace.json # Project workspace config
```

---

## 9. MVP scope

### Phase 1 &mdash; Foundation

- [ ] Listing schema + CRUD API.
- [ ] Browse page with filters (type, category, price).
- [ ] Listing detail page with org-chart visualisation.
- [ ] Creator registration + listing-creation wizard.
- [ ] Free installs only (no payments yet).
- [ ] Install flow: blueprint &rarr; GitMesh project.

### Phase 2 &mdash; Payments & social

- [ ] Stripe Connect integration.
- [ ] Purchase flow.
- [ ] Review system.
- [ ] Creator analytics dashboard.
- [ ] `Export from GitMesh` CLI command.

### Phase 3 &mdash; Growth

- [ ] Search with relevance ranking.
- [ ] Featured / trending listings.
- [ ] Creator verification programme.
- [ ] Blueprint versioning + update notifications.
- [ ] Live demo sandbox.
- [ ] API for programmatic publishing.
