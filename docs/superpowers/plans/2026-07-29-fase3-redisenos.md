# Fase 3 — Rediseños: Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 5 redesign improvements: sub-section anchors in Municipalidad, split-view preview, user edit drawer, temporary password UX, and process modal simplification.

**Architecture:** Larger component restructures; new drawer component; existing form stays but layout changes.

**Tech Stack:** React 19 + TypeScript strict + Tailwind CSS + CSS `position: sticky` for split-view.

**Global Constraints:**
- All changes must pass `npm run lint && npm run typecheck && npm run test`
- No new dependencies
- Drawer uses `position: fixed` + portal (no library)

---

### Task 1: Sub-section anchors in municipalidad-tab.tsx

**Files:**
- Modify: `municipalidad-tab.tsx`

**Interfaces:**
- Consumes: existing form sections with `id` attributes
- Produces: sticky anchor nav + IntersectionObserver for active section

- [ ] **Step 1: Add `id` attributes to each section**

Wrap each form section in a `<section id="datos">`, `<section id="gobierno">`, etc.

- [ ] **Step 2: Add IntersectionObserver to track active section**

```tsx
const [activeSection, setActiveSection] = useState('datos');

useEffect(() => {
  const sections = document.querySelectorAll('[data-section]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    },
    { rootMargin: '-80px 0px -60% 0px' }
  );
  sections.forEach((s) => observer.observe(s));
  return () => observer.disconnect();
}, []);
```

- [ ] **Step 3: Add sticky anchor nav**

```tsx
const SECCIONES = [
  { id: 'datos', label: 'Datos de la entidad' },
  { id: 'gobierno', label: 'Tipo de gobierno' },
  { id: 'gerente', label: 'Gerente municipal' },
  { id: 'pac', label: 'PAC y montos' },
  { id: 'preview', label: 'Vista previa' },
];

// Render nav:
<nav className="tw-sticky tw-top-4 tw-z-10 tw-flex tw-gap-1 tw-overflow-x-auto tw-pb-2 tw-mb-6 tw-border-b">
  {SECCIONES.map(sec => (
    <a
      key={sec.id}
      href={`#${sec.id}`}
      onClick={(e) => { e.preventDefault(); document.getElementById(sec.id)?.scrollIntoView({ behavior: 'smooth' }); }}
      className={`tw-whitespace-nowrap tw-px-3 tw-py-1.5 tw-text-xs tw-rounded-md tw-transition-colors ${
        activeSection === sec.id
          ? 'tw-bg-primary tw-text-primary-foreground'
          : 'tw-text-muted-foreground hover:tw-bg-muted'
      }`}
    >
      {sec.label}
    </a>
  ))}
</nav>
```

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

### Task 2: Split-view preview in municipalidad-tab.tsx

**Files:**
- Modify: `municipalidad-tab.tsx`

- [ ] **Step 1: Change layout to 2-column grid**

Wrap the main content and preview in:

```tsx
<div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-[1fr_320px] tw-gap-6">
  <div>
    {/* existing form sections */}
  </div>
  <aside className="tw-sticky tw-top-20 tw-self-start">
    {/* preview content */}
  </aside>
</div>
```

- [ ] **Step 2: Hide preview aside on mobile, show toggle**

```tsx
const [showPreview, setShowPreview] = useState(false);
```

On mobile (<1024px), the preview is hidden by default and shown via a button in the nav.

- [ ] **Step 3: Run lint + typecheck**

- [ ] **Step 4: Commit**

---

### Task 3: User edit drawer

**Files:**
- Modify: `usuarios-tab.tsx`
- Possibly create: `app/components/configuracion/user-edit-drawer.tsx`

- [ ] **Step 1: Create drawer component** (or inline if preferred)

The drawer is a fixed overlay from the right side. Key classes:
- Container: `tw-fixed tw-inset-0 tw-z-50 tw-flex` at `tw-justify-end`
- Overlay: `tw-fixed tw-inset-0 tw-bg-black/30`
- Panel: `tw-relative tw-w-full tw-max-w-md tw-h-full tw-bg-background tw-shadow-xl tw-overflow-y-auto tw-p-6`

- [ ] **Step 2: Move edit form into drawer**

Replace the inline edit form with a drawer trigger. When "Editar" is clicked, set the selected user and open the drawer.

- [ ] **Step 3: Add keyboard support**

Close on `Escape` key. Focus trap (basic: focus first input on open).

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

### Task 4: Temporary password UX

**Files:**
- Modify: `usuarios-tab.tsx`

- [ ] **Step 1: Add copy button** next to each credential

```tsx
<button
  onClick={() => { navigator.clipboard.writeText(cred.password); setCopied(cred.id); setTimeout(() => setCopied(null), 2000); }}
  className="tw-text-xs tw-text-primary hover:tw-underline"
>
  {copied === cred.id ? 'Copiado ✓' : 'Copiar'}
</button>
```

- [ ] **Step 2: Add download .txt button**

```tsx
function descargarCredenciales() {
  const text = createdCredentials.map(c => `Usuario: ${c.email}\nContraseña: ${c.password}\n`).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'credenciales.txt';
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Add "Ya la entregué" button** to discard credentials individually

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

### Task 5: Simplify process card hierarchy

**Files:**
- Modify: `procesos-modal.tsx`

- [ ] **Step 1: Condense card header**

Reduce padding: `tw-p-4` → `tw-p-3`. Reduce font size of name. Make tags smaller.

- [ ] **Step 2: Move less important fields to "Opciones avanzadas"**

Move "Categoría" and "Descripción operativa" into the existing collapsible advanced section (which already contains "Código" and "Orden").

- [ ] **Step 3: Default visible fields: only Objeto + Sustento legal**

- [ ] **Step 4: Run lint + typecheck**

- [ ] **Step 5: Commit**

---

## Verification

```bash
npm run lint; if ($?) { npm run typecheck; } if ($?) { npm run test; }
```
