#!/usr/bin/env python3
"""usage: python3 src/products/tulvo/tools/gen-app-icons.py [dom_dir] [out_tsx]
Generate src/products/tulvo/icons/app-icons.tsx from the live DOM snapshots: the app's own
(non-lucide) SVG icons, copied path-for-path. Brand logos (Slack/Notion/Google) are NOT
copied (third-party marks)."""
import sys, re, glob, os, json
from html.parser import HTMLParser

HERE = os.path.dirname(os.path.abspath(__file__))
DOM = sys.argv[1] if len(sys.argv) > 1 else "research/ui-live/dom"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "..", "icons", "app-icons.tsx")
VOID = {"area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"}

class N:
    def __init__(s, tag, attrs, parent):
        s.tag, s.attrs, s.parent, s.children = tag, dict(attrs), parent, []
class P(HTMLParser):
    def __init__(s):
        super().__init__(convert_charrefs=True)
        s.root = N("#root", [], None); s.cur = s.root
    def handle_starttag(s, tag, attrs):
        n = N(tag, attrs, s.cur); s.cur.children.append(n)
        if tag not in VOID: s.cur = n
    def handle_startendtag(s, tag, attrs):
        n = N(tag, attrs, s.cur); s.cur.children.append(n)
    def handle_endtag(s, tag):
        c = s.cur
        while c is not None and c.tag != tag: c = c.parent
        if c is not None and c.parent is not None: s.cur = c.parent
    def handle_data(s, d): pass

svgs = []
for f in sorted(glob.glob(DOM + "/*.html")):
    p = P(); p.feed(open(f).read())
    def walk(n):
        for c in n.children:
            if c.tag == "svg": svgs.append((os.path.basename(f), c)); continue
            walk(c)
    walk(p.root)

def first_d(svg):
    for c in svg.children:
        if c.tag == "path": return c.attrs.get("d", "")
        r = first_d(c)
        if r: return r
    return ""

TARGETS = [
    # name, predicate, doc
    ("CollapseSidebarIcon", lambda s: s.attrs.get("aria-label") == "Collapse sidebar", "Sidebar header: collapse-sidebar toggle (16x16)."),
    ("HomeIcon", lambda s: first_d(s).startswith("M3 11.99v2.51"), "Sidebar nav: Home (custom, stroke 1.5)."),
    ("TulvoAiIcon", lambda s: first_d(s).startswith("M6.40039 4.07474"), "Sidebar nav + AI panel: Tulvo AI sparkle."),
    ("TablerLayoutGrid", lambda s: "tabler-icon-layout-grid" in s.attrs.get("class", ""), "Sidebar page items: tabler layout-grid (page icon)."),
    ("TablerFileText", lambda s: "tabler-icon-file-text" in s.attrs.get("class", ""), "Template editor: tabler file-text."),
    ("SupportEmailIcon", lambda s: first_d(s).startswith("M4.66602 5.66699"), "Sidebar support card: envelope (16x16)."),
    ("TrashIcon", lambda s: first_d(s).startswith("m19.5 5.5-.62 10.025"), "Sidebar footer: Trash (custom, stroke 1.5)."),
    ("TabActionsIcon", lambda s: first_d(s).startswith("M3.625 7.5C3.625"), "Board tabs: tab actions (dots, 15x15)."),
    ("KanbanLayoutIcon", lambda s: "lucide-kanban-layout" in s.attrs.get("class", ""), "Board view switcher: kanban layout (app-made lucide-style icon)."),
    ("AiFocusIcon", lambda s: first_d(s).startswith("M9.1304 2.5C6.4641"), "AI panel suggestion: What should I focus on?"),
    ("AiStatusReportIcon", lambda s: first_d(s).startswith("M8.004 17H16.004"), "AI panel suggestion: Outline a status report."),
    ("AiWorkspaceIcon", lambda s: first_d(s).startswith("M9.6096 4.813"), "AI panel suggestion: Ask about my workspace."),
    ("AiHelpIcon", lambda s: first_d(s).startswith("M9.801 6.19C10.123"), "AI panel suggestion: What can you help with?"),
]

def camel(k):
    if k == "class": return "className"
    if k == "viewbox": return "viewBox"
    if k.startswith("aria-") or k.startswith("data-"): return k
    parts = k.split("-")
    return parts[0] + "".join(p.title() for p in parts[1:])

KEEP_ROOT = {"viewbox", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "width", "height"}

def jsx_children(n, indent):
    out = []
    for c in n.children:
        attrs = " ".join(f'{camel(k)}="{v}"' for k, v in c.attrs.items() if k not in ("class", "style"))
        if c.children:
            out.append(f"{indent}<{c.tag} {attrs}>")
            out.extend(jsx_children(c, indent + "  "))
            out.append(f"{indent}</{c.tag}>")
        else:
            out.append(f"{indent}<{c.tag} {attrs} />")
    return out

blocks = []
docs = []
for name, pred, doc in TARGETS:
    hit = next(((f, s) for f, s in svgs if pred(s)), None)
    if not hit:
        print("MISSING", name); continue
    f, s = hit
    root = {k: v for k, v in s.attrs.items() if k in KEEP_ROOT}
    w = root.pop("width", "24"); h = root.pop("height", "24")
    rattrs = " ".join(f'{camel(k)}="{v}"' for k, v in root.items())
    body = "\n".join(jsx_children(s, "      "))
    blocks.append(f'''/** {doc} Source: {f}, class="{s.attrs.get("class", "")}" */
export const {name}: React.FC<AppIconProps> = ({{ size, className, style, title }}) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={{size ?? {json.dumps(w.replace("px",""))}}} height={{size ?? {json.dumps(h.replace("px",""))}}} {rattrs} className={{className}} style={{style}} aria-hidden={{title ? undefined : true}}>
      {{title ? <title>{{title}}</title> : null}}
{body}
  </svg>
);
''')

header = '''/**
 * GENERATED from the live Tulvo DOM snapshots (research/ui-live/dom/*.html), path-for-path.
 * These are the app's own non-lucide SVG icons. Lucide icons come from lucide-react@0.479.0
 * (see icons.md). Third-party brand logos (Slack, Notion, Google) are deliberately NOT here:
 * use <IntegrationLogoSlot/> from ./IntegrationLogoSlot instead.
 */
import React from "react";

export type AppIconProps = {
  /** Overrides the intrinsic width/height attributes (CSS classes like w-4 h-4 still win). */
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

'''
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(header + "\n".join(blocks))
print("wrote", OUT, len(blocks), "icons")
