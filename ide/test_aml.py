#!/usr/bin/env python3
"""
AML Widget Tester - Renders AML to HTML for quick testing
"""

import re
import sys
from html import escape

# Color palette from IDE
COLORS = {
    'bg': '#161614',
    'bg_card': '#1c1c1a',
    'bg_header': '#252523',
    'border': '#2a2a28',
    'text': '#e8e8e6',
    'text_secondary': '#d4d4d0',
    'text_muted': '#888880',
    'accent': '#7c9a6d',
    'error': '#d95555',
    'warning': '#d9aa55',
    'tip': '#7daea3',
}

HTML_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            background: {bg};
            color: {text};
            font-family: -apple-system, BlinkMacSystemFont, 'SF Pro', sans-serif;
            font-size: 13px;
            line-height: 1.6;
            padding: 20px;
        }}
        .message {{
            background: {bg_card};
            border: 1px solid {border};
            border-radius: 8px;
            padding: 16px;
            max-width: 600px;
        }}
        
        /* Buttons */
        .trait-button {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 12px;
            background: rgba(124, 154, 109, 0.12);
            border: 1px solid rgba(124, 154, 109, 0.2);
            border-radius: 4px;
            color: #7c9a6d;
            font-size: 12px;
            font-weight: 500;
            margin: 2px;
        }}
        
        /* Code */
        .trait-code-block {{
            margin: 8px 0;
            border-radius: 6px;
            overflow: hidden;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
        }}
        .trait-code-header {{
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 11px;
        }}
        .trait-code-file {{ color: #7c9a6d; font-family: monospace; }}
        .trait-code-lang {{ color: #5a5a52; text-transform: uppercase; font-size: 10px; }}
        .trait-code {{
            margin: 0;
            padding: 10px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
            color: #d4d4d0;
            overflow-x: auto;
        }}
        
        .trait-coderef {{
            display: inline;
            padding: 1px 6px;
            background: rgba(124, 154, 109, 0.1);
            border: 1px solid rgba(124, 154, 109, 0.15);
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #7c9a6d;
        }}
        
        /* Diff */
        .trait-diff {{
            margin: 8px 0;
            border-radius: 6px;
            overflow: hidden;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
        }}
        .trait-diff-header {{
            padding: 6px 10px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 11px;
            color: #888880;
            font-family: monospace;
        }}
        .trait-diff-line {{
            display: flex;
            padding: 1px 10px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        .trait-diff-added {{ background: rgba(124, 154, 109, 0.08); }}
        .trait-diff-removed {{ background: rgba(217, 85, 85, 0.08); }}
        .trait-diff-added .trait-diff-marker {{ color: #7c9a6d; }}
        .trait-diff-removed .trait-diff-marker {{ color: #d95555; }}
        .trait-diff-marker {{ width: 14px; color: #5a5a52; }}
        .trait-diff-text {{ color: #d4d4d0; }}
        
        /* File */
        .trait-file {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 2px 8px;
            background: rgba(124, 154, 109, 0.08);
            border: 1px solid rgba(124, 154, 109, 0.12);
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #7c9a6d;
        }}
        
        /* Lists */
        .trait-list {{
            margin: 8px 0;
            padding-left: 20px;
            color: #d4d4d0;
        }}
        .trait-item {{ margin: 3px 0; }}
        
        /* TODO */
        .trait-todo {{
            margin: 8px 0;
            padding: 12px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
        }}
        .trait-todo-header {{
            margin-bottom: 10px;
            font-size: 11px;
            font-weight: 600;
            color: #888880;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .trait-todo-list {{ list-style: none; margin: 0; padding: 0; }}
        .trait-todo-item {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 4px 0;
            font-size: 13px;
            color: #d4d4d0;
        }}
        .trait-todo-done {{ opacity: 0.5; text-decoration: line-through; }}
        
        /* Table */
        .trait-table {{
            width: 100%;
            margin: 8px 0;
            border-collapse: collapse;
            font-size: 12px;
        }}
        .trait-row {{ border-bottom: 1px solid rgba(124, 154, 109, 0.08); }}
        .trait-row-header th {{
            padding: 8px 10px;
            text-align: left;
            font-weight: 500;
            color: #888880;
            font-size: 10px;
            text-transform: uppercase;
            background: rgba(26, 26, 24, 0.4);
        }}
        .trait-cell {{ padding: 8px 10px; color: #d4d4d0; }}
        
        /* Badge */
        .trait-badge {{
            display: inline-flex;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 500;
            margin: 0 2px;
        }}
        .trait-badge-success {{ background: rgba(124, 154, 109, 0.15); color: #7c9a6d; }}
        .trait-badge-warning {{ background: rgba(217, 170, 85, 0.15); color: #d9aa55; }}
        .trait-badge-error {{ background: rgba(217, 85, 85, 0.15); color: #d95555; }}
        
        /* Tag */
        .trait-tag {{
            display: inline-flex;
            padding: 1px 6px;
            background: rgba(124, 154, 109, 0.08);
            border: 1px solid rgba(124, 154, 109, 0.12);
            border-radius: 3px;
            font-size: 11px;
            color: #888880;
            margin: 0 2px;
        }}
        
        /* Progress */
        .trait-progress {{ margin: 8px 0; }}
        .trait-progress-label {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #888880;
            margin-bottom: 4px;
        }}
        .trait-progress-bar {{
            height: 4px;
            background: rgba(124, 154, 109, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }}
        .trait-progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #7c9a6d, #6a8a5d);
            border-radius: 2px;
        }}
        
        /* Metric */
        .trait-metric {{
            display: inline-flex;
            flex-direction: column;
            padding: 12px 16px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
            min-width: 80px;
        }}
        .trait-metric-value {{ font-size: 22px; font-weight: 600; color: #e8e8e6; }}
        .trait-metric-label {{
            margin-top: 4px;
            font-size: 10px;
            color: #5a5a52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .trait-metric-change {{ margin-top: 6px; font-size: 11px; }}
        .trait-metric-change-up {{ color: #7c9a6d; }}
        .trait-metric-change-down {{ color: #d95555; }}
        
        /* Chart */
        .trait-chart {{
            margin: 8px 0;
            padding: 12px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
        }}
        .trait-chart-title {{
            font-size: 11px;
            font-weight: 500;
            color: #888880;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .trait-chart-content {{
            display: flex;
            align-items: flex-end;
            gap: 8px;
            height: 80px;
        }}
        .trait-chart-bar {{
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 20px;
            background: rgba(124, 154, 109, 0.6);
            border-radius: 2px 2px 0 0;
        }}
        .trait-chart-bar-value {{ margin-top: -14px; font-size: 9px; color: #e8e8e6; }}
        .trait-chart-bar-label {{ margin-top: 4px; font-size: 9px; color: #5a5a52; }}
        
        /* Terminal */
        .trait-terminal {{
            margin: 8px 0;
            border-radius: 6px;
            overflow: hidden;
            background: rgba(10, 10, 10, 0.9);
            border: 1px solid rgba(124, 154, 109, 0.08);
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        .trait-terminal-header {{
            display: flex;
            justify-content: space-between;
            padding: 6px 10px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
        }}
        .trait-terminal-title {{ font-size: 11px; color: #5a5a52; }}
        .trait-terminal-content {{ padding: 10px; line-height: 1.5; }}
        .trait-command {{ color: #7c9a6d; }}
        .trait-command::before {{ content: '$ '; color: #5a5a52; }}
        .trait-output {{ color: #d4d4d0; }}
        .trait-output-stderr {{ color: #d9aa55; }}
        .trait-output-error {{ color: #d95555; }}
        .trait-output-success {{ color: #7c9a6d; }}
        
        /* Alerts */
        .trait-alert {{
            display: flex;
            gap: 8px;
            padding: 10px 12px;
            margin: 8px 0;
            border-radius: 6px;
            font-size: 13px;
            line-height: 1.5;
            border-left: 2px solid;
        }}
        .trait-alert-icon {{ flex-shrink: 0; font-size: 14px; }}
        .trait-alert-info {{ background: rgba(124, 154, 109, 0.08); border-color: #7c9a6d; color: #a8c49a; }}
        .trait-alert-warning {{ background: rgba(217, 170, 85, 0.08); border-color: #d9aa55; color: #e4c078; }}
        .trait-alert-error {{ background: rgba(217, 85, 85, 0.08); border-color: #d95555; color: #e08585; }}
        .trait-alert-success {{ background: rgba(124, 154, 109, 0.1); border-color: #7c9a6d; color: #a8c49a; }}
        .trait-alert-tip {{ background: rgba(125, 174, 163, 0.08); border-color: #7daea3; color: #9ac9c0; }}
        
        /* Card */
        .trait-card {{
            margin: 8px 0;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
            overflow: hidden;
        }}
        .trait-card-title {{
            padding: 10px 12px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 12px;
            font-weight: 500;
            color: #e8e8e6;
        }}
        .trait-card-content {{ padding: 12px; }}
        
        /* Grid */
        .trait-grid {{
            display: grid;
            gap: 8px;
            margin: 8px 0;
        }}
        
        /* Divider */
        .trait-divider {{
            margin: 12px 0;
            border: none;
            border-top: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        /* File Tree */
        .trait-filetree {{
            margin: 8px 0;
            padding: 12px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        .trait-filetree-header {{
            margin-bottom: 8px;
            font-size: 10px;
            color: #5a5a52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        .trait-folder {{ margin: 2px 0; }}
        .trait-folder-header {{
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 2px 6px;
            border-radius: 3px;
            cursor: pointer;
            color: #d4d4d0;
        }}
        .trait-folder-children {{ padding-left: 16px; }}
        
        /* Search */
        .trait-search {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
            margin: 8px 0;
            font-size: 12px;
        }}
        .trait-search-query {{ font-family: 'JetBrains Mono', monospace; color: #e8e8e6; }}
        .trait-search-results {{ margin-left: auto; font-size: 11px; color: #5a5a52; }}
        
        /* Breadcrumb */
        .trait-breadcrumb {{
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 6px 10px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 4px;
            font-size: 12px;
            margin: 8px 0;
        }}
        .trait-breadcrumb-separator {{ color: #3a3a38; }}
        
        /* Timestamp */
        .trait-timestamp {{ font-size: 11px; color: #5a5a52; font-family: monospace; }}
        
        /* Link */
        .trait-link {{ color: #7c9a6d; text-decoration: underline; }}
        
        /* Text content */
        .trait-text-content {{ color: #d4d4d0; line-height: 1.6; }}
        .trait-text-content p {{ margin: 0 0 8px 0; }}
        .trait-text-content p:last-child {{ margin-bottom: 0; }}
    </style>
</head>
<body>
    <div class="message">
        {content}
    </div>
</body>
</html>'''


def parse_attrs(attr_str: str) -> dict:
    """Parse XML attributes"""
    attrs = {}
    # Match attr="value" or attr='value'
    for match in re.finditer(r'([\w-]+)=["\']([^"\']*)["\']', attr_str):
        attrs[match.group(1)] = match.group(2)
    return attrs


def render_button(attrs: dict, content: str) -> str:
    return f'<span class="trait-button">{escape(content)}</span>'


def render_code(attrs: dict, content: str) -> str:
    file_attr = f'<span class="trait-code-file">{attrs.get("file", "")}</span>' if "file" in attrs else ""
    lang_attr = f'<span class="trait-code-lang">{attrs.get("language", "")}</span>' if "language" in attrs else ""
    return f'''<div class="trait-code-block">
    <div class="trait-code-header">{file_attr}{lang_attr}</div>
    <pre class="trait-code">{escape(content)}</pre>
</div>'''


def render_coderef(attrs: dict) -> str:
    text = attrs.get("text", attrs.get("path", ""))
    return f'<code class="trait-coderef">{escape(text)}</code>'


def render_diff(attrs: dict, content: str) -> str:
    lines = content.strip().split('\n')
    lines_html = []
    for line in lines:
        if line.startswith('+'):
            lines_html.append(f'<div class="trait-diff-line trait-diff-added"><span class="trait-diff-marker">+</span><span class="trait-diff-text">{escape(line[1:])}</span></div>')
        elif line.startswith('-'):
            lines_html.append(f'<div class="trait-diff-line trait-diff-removed"><span class="trait-diff-marker">-</span><span class="trait-diff-text">{escape(line[1:])}</span></div>')
        else:
            lines_html.append(f'<div class="trait-diff-line"><span class="trait-diff-marker"> </span><span class="trait-diff-text">{escape(line)}</span></div>')
    
    header = f'<div class="trait-diff-header">{attrs.get("file", "")}</div>' if "file" in attrs else ""
    return f'<div class="trait-diff">{header}<div class="trait-diff-content">{ "".join(lines_html) }</div></div>'


def render_file(attrs: dict) -> str:
    name = attrs.get("name", attrs.get("path", "").split('/')[-1])
    line = f':{attrs["line"]}' if "line" in attrs else ""
    return f'<span class="trait-file">/{escape(name)}{line}</span>'


def render_list(attrs: dict, content: str) -> str:
    items = re.findall(r'<trait:item[^>]*>(.*?)</trait:item>', content, re.DOTALL)
    items_html = ''.join([f'<li class="trait-item">{escape(item.strip())}</li>' for item in items])
    tag = 'ol' if attrs.get('ordered') == 'true' else 'ul'
    return f'<{tag} class="trait-list">{items_html}</{tag}>'


def render_todo(attrs: dict, content: str) -> str:
    items = re.findall(r'<trait:item\s+done="([^"]*)"[^>]*>(.*?)</trait:item>', content, re.DOTALL)
    items_html = ''.join([
        f'<li class="trait-todo-item {"trait-todo-done" if done == "true" else ""}"><input type="checkbox" {"checked" if done == "true" else ""} disabled> <span>{escape(text.strip())}</span></li>'
        for done, text in items
    ])
    title = f'<div class="trait-todo-header">{attrs.get("title", "Tasks")}</div>' if "title" in attrs else ""
    return f'<div class="trait-todo">{title}<ul class="trait-todo-list">{items_html}</ul></div>'


def render_table(attrs: dict, content: str) -> str:
    rows = re.findall(r'<trait:row\s+header="true"[^>]*>(.*?)</trait:row>', content, re.DOTALL)
    data_rows = re.findall(r'<trait:row[^>]*>(.*?)</trait:row>', content, re.DOTALL)
    
    def render_cells(row_content: str) -> str:
        cells = re.findall(r'<trait:cell[^>]*>(.*?)</trait:cell>', row_content, re.DOTALL)
        return ''.join([f'<td class="trait-cell">{escape(cell.strip())}</td>' for cell in cells])
    
    header_html = ''
    if rows:
        header_html = f'<tr class="trait-row trait-row-header">{render_cells(rows[0]).replace("<td", "<th").replace("/td>", "/th>")}</tr>'
    
    data_html = ''.join([f'<tr class="trait-row">{render_cells(row)}</tr>' for row in data_rows if row not in rows])
    return f'<table class="trait-table"><tbody>{header_html}{data_html}</tbody></table>'


def render_badge(attrs: dict, content: str) -> str:
    variant = attrs.get("variant", "default")
    return f'<span class="trait-badge trait-badge-{variant}">{escape(content)}</span>'


def render_tag(attrs: dict, content: str) -> str:
    return f'<span class="trait-tag">{escape(content)}</span>'


def render_progress(attrs: dict) -> str:
    value = int(attrs.get("value", 0))
    max_val = int(attrs.get("max", 100))
    pct = min(100, max(0, (value / max_val) * 100))
    label = attrs.get("label", f"{value}/{max_val}")
    return f'''<div class="trait-progress">
    <div class="trait-progress-label"><span>{label}</span><span>{value}/{max_val}</span></div>
    <div class="trait-progress-bar"><div class="trait-progress-fill" style="width: {pct}%"></div></div>
</div>'''


def render_metric(attrs: dict) -> str:
    return f'''<div class="trait-metric">
    <div class="trait-metric-value">{attrs.get("value", "")}</div>
    <div class="trait-metric-label">{attrs.get("label", "")}</div>
</div>'''


def render_chart(attrs: dict, content: str) -> str:
    data_points = re.findall(r'<trait:data\s+label="([^"]*)"\s+value="([^"]*)"[^/]*/>', content)
    max_val = max([int(v) for _, v in data_points], default=1)
    bars_html = ''.join([
        f'<div class="trait-chart-bar" style="height: {max(10, (int(v)/max_val)*80)}%"><div class="trait-chart-bar-value">{v}</div><div class="trait-chart-bar-label">{l}</div></div>'
        for l, v in data_points
    ])
    title = f'<div class="trait-chart-title">{attrs.get("title", "")}</div>' if "title" in attrs else ""
    return f'<div class="trait-chart">{title}<div class="trait-chart-content">{bars_html}</div></div>'


def render_terminal(attrs: dict, content: str) -> str:
    commands = re.findall(r'<trait:command[^>]*>(.*?)</trait:command>', content, re.DOTALL)
    outputs = re.findall(r'<trait:output\s+type="([^"]*)"[^>]*>(.*?)</trait:output>', content, re.DOTALL)
    
    cmd_html = ''.join([f'<div class="trait-command">{escape(cmd.strip())}</div>' for cmd in commands])
    out_html = ''.join([f'<div class="trait-output trait-output-{t}">{escape(o.strip())}</div>' for t, o in outputs])
    
    title = attrs.get("title", "Terminal")
    return f'<div class="trait-terminal"><div class="trait-terminal-header"><span class="trait-terminal-title">{title}</span></div><div class="trait-terminal-content">{cmd_html}{out_html}</div></div>'


def render_alert(type_: str, content: str) -> str:
    icons = {'info': 'ℹ', 'warning': '⚠', 'error': '✕', 'success': '✓', 'tip': '💡'}
    return f'<div class="trait-alert trait-alert-{type_}"><span class="trait-alert-icon">{icons.get(type_, "ℹ")}</span><span>{escape(content.strip())}</span></div>'


def render_card(attrs: dict, content: str) -> str:
    title = f'<div class="trait-card-title">{escape(attrs.get("title", ""))}</div>' if "title" in attrs else ""
    inner = render_aml(content)
    return f'<div class="trait-card">{title}<div class="trait-card-content">{inner}</div></div>'


def render_grid(attrs: dict, content: str) -> str:
    cols = attrs.get("cols", "3")
    children = render_aml(content)
    return f'<div class="trait-grid" style="grid-template-columns: repeat({cols}, 1fr);">{children}</div>'


def render_filetree(attrs: dict, content: str) -> str:
    root = attrs.get("root", "Files")
    inner = render_aml(content)
    return f'<div class="trait-filetree"><div class="trait-filetree-header">{root}</div>{inner}</div>'


def render_folder(attrs: dict, content: str) -> str:
    name = attrs.get("name", "folder")
    inner = render_aml(content)
    return f'<div class="trait-folder"><div class="trait-folder-header">▼ {escape(name)}</div><div class="trait-folder-children">{inner}</div></div>'


def render_search(attrs: dict) -> str:
    query = attrs.get("query", "")
    results = attrs.get("results", "")
    res_html = f'<span class="trait-search-results">{results}</span>' if results else ""
    return f'<div class="trait-search">🔍 <span class="trait-search-query">{escape(query)}</span>{res_html}</div>'


def render_breadcrumb(attrs: dict, content: str) -> str:
    tags = re.findall(r'<trait:tag[^>]*>(.*?)</trait:tag>', content)
    items = [f'<span class="trait-tag">{escape(t)}</span>' for t in tags]
    sep = '<span class="trait-breadcrumb-separator">/</span>'
    return f'<div class="trait-breadcrumb">{sep.join(items)}</div>'


def render_divider() -> str:
    return '<hr class="trait-divider">'


def render_spacer(attrs: dict) -> str:
    size = attrs.get("size", "12px")
    return f'<div style="height: {size}"></div>'


def render_br() -> str:
    return '<br>'


def render_timestamp(attrs: dict) -> str:
    return f'<span class="trait-timestamp">{attrs.get("value", "")}</span>'


def render_link(attrs: dict, content: str) -> str:
    return f'<span class="trait-link">{escape(content)}</span>'


def render_widget(tag_name: str, attrs: dict, content: str) -> str:
    """Render a single widget"""
    renderers = {
        'trait:button': lambda a, c: render_button(a, c),
        'trait:code': lambda a, c: render_code(a, c),
        'trait:coderef': lambda a, c: render_coderef(a),
        'trait:diff': lambda a, c: render_diff(a, c),
        'trait:file': lambda a, c: render_file(a),
        'trait:list': lambda a, c: render_list(a, c),
        'trait:todo': lambda a, c: render_todo(a, c),
        'trait:table': lambda a, c: render_table(a, c),
        'trait:badge': lambda a, c: render_badge(a, c),
        'trait:tag': lambda a, c: render_tag(a, c),
        'trait:progress': lambda a, c: render_progress(a),
        'trait:metric': lambda a, c: render_metric(a),
        'trait:chart': lambda a, c: render_chart(a, c),
        'trait:barchart': lambda a, c: render_chart(a, c),
        'trait:terminal': lambda a, c: render_terminal(a, c),
        'trait:info': lambda a, c: render_alert('info', c),
        'trait:warning': lambda a, c: render_alert('warning', c),
        'trait:error': lambda a, c: render_alert('error', c),
        'trait:success': lambda a, c: render_alert('success', c),
        'trait:tip': lambda a, c: render_alert('tip', c),
        'trait:card': lambda a, c: render_card(a, c),
        'trait:grid': lambda a, c: render_grid(a, c),
        'trait:divider': lambda a, c: render_divider(),
        'trait:spacer': lambda a, c: render_spacer(a),
        'trait:br': lambda a, c: render_br(),
        'trait:filetree': lambda a, c: render_filetree(a, c),
        'trait:folder': lambda a, c: render_folder(a, c),
        'trait:search': lambda a, c: render_search(a),
        'trait:breadcrumb': lambda a, c: render_breadcrumb(a, c),
        'trait:timestamp': lambda a, c: render_timestamp(a),
        'trait:link': lambda a, c: render_link(a, c),
        'trait:item': lambda a, c: escape(c),  # Fallback
    }
    
    renderer = renderers.get(tag_name)
    if renderer:
        return renderer(attrs, content)
    return f'<span style="color: #d95555;">Unknown: {tag_name}</span>'


def render_aml(content: str) -> str:
    """Render AML content to HTML"""
    result = []
    pos = 0
    
    while pos < len(content):
        # Find next tag
        match = re.search(r'<(trait:[a-z]+)([^>]*)>', content[pos:], re.IGNORECASE)
        if not match:
            # Remaining text
            text = content[pos:].strip()
            if text:
                result.append(f'<div class="trait-text-content"><p>{escape(text)}</p></div>')
            break
        
        tag_start = pos + match.start()
        tag_name = match.group(1).lower()
        attrs_str = match.group(2)
        
        # Add text before tag
        if tag_start > pos:
            text = content[pos:tag_start].strip()
            if text:
                result.append(f'<div class="trait-text-content"><p>{escape(text)}</p></div>')
        
        # Check if self-closing
        if attrs_str.endswith('/') or content[tag_start + len(match.group(0)) - 1] == '/':
            # Self-closing
            attrs = parse_attrs(attrs_str)
            result.append(render_widget(tag_name, attrs, ''))
            pos = tag_start + len(match.group(0))
            continue
        
        # Find closing tag
        close_tag = f'</{tag_name}>'
        close_pos = content.lower().find(close_tag, tag_start + len(match.group(0)))
        
        if close_pos == -1:
            # No closing tag - treat as text
            result.append(escape(match.group(0)))
            pos = tag_start + len(match.group(0))
            continue
        
        # Extract content
        inner_start = tag_start + len(match.group(0))
        inner_content = content[inner_start:close_pos]
        
        # Parse attributes
        attrs = parse_attrs(attrs_str)
        
        # Render widget
        result.append(render_widget(tag_name, attrs, inner_content))
        
        pos = close_pos + len(close_tag)
    
    return ''.join(result)


def main():
    # Test examples
    test_cases = [
        # Test 1: Simple card with list
        '''<trait:card title="Code Operations">
  <trait:list ordered="false">
    <trait:item>Read files</trait:item>
    <trait:item>Edit code</trait:item>
    <trait:item>Run commands</trait:item>
  </trait:list>
</trait:card>''',

        # Test 2: Multiple cards
        '''<trait:card title="First Card">
  <trait:item>Item 1</trait:item>
</trait:card>
<trait:card title="Second Card">
  <trait:item>Item 2</trait:item>
</trait:card>''',

        # Test 3: Full help response
        '''I can help you with various coding tasks.

<trait:card title="Code Operations">
  <trait:list ordered="false">
    <trait:item>Read files to understand your codebase</trait:item>
    <trait:item>Edit code using precise replacements</trait:item>
    <trait:item>Search across files with grep</trait:item>
    <trait:item>Run terminal commands</trait:item>
  </trait:list>
</trait:card>

<trait:card title="Common Tasks">
  <trait:list ordered="false">
    <trait:item>Debug issues and fix bugs</trait:item>
    <trait:item>Add features or refactor code</trait:item>
    <trait:item>Write tests</trait:item>
    <trait:item>Review code quality</trait:item>
  </trait:list>
</trait:card>''',

        # Test 4: Metrics and grid
        '''<trait:grid cols="3">
  <trait:metric value="84%" label="Coverage" />
  <trait:metric value="1.2k" label="Files" />
  <trait:metric value="12" label="Errors" />
</trait:grid>''',

        # Test 5: Code block
        '''<trait:code file="/src/main.ts" language="typescript">
import { app } from 'electron';

app.whenReady().then(() => {
  console.log('Ready!');
});
</trait:code>''',

        # Test 6: Diff
        '''<trait:diff file="/src/app.ts">
- function old() { return false; }
+ function new() { return true; }
</trait:diff>''',

        # Test 7: Terminal
        '''<trait:terminal title="Build">
  <trait:command>npm run build</trait:command>
  <trait:output type="stdout">Building...</trait:output>
  <trait:output type="success">Done!</trait:output>
</trait:terminal>''',
    ]
    
    if len(sys.argv) > 1:
        # Use command line argument
        aml_input = sys.argv[1]
    else:
        # Use test case
        aml_input = test_cases[2]  # Help response
    
    html_content = render_aml(aml_input)
    full_html = HTML_TEMPLATE.format(**COLORS, content=html_content)
    
    output_path = '/Users/mac/kimi-vscode/ide/aml_test_output.html'
    with open(output_path, 'w') as f:
        f.write(full_html)
    
    print(f"Rendered to: {output_path}")
    print(f"Open in browser: file://{output_path}")


if __name__ == '__main__':
    main()
