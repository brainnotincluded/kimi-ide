#!/usr/bin/env python3
"""
AML Widget Scenarios - 30 comprehensive test cases
"""

import re
import sys
from html import escape

# Extended color palette
COLORS = {
    'bg': '#161614',
    'bg_card': '#1c1c1a',
    'bg_header': '#252523',
    'border': '#2a2a28',
    'text': '#e8e8e6',
    'text_secondary': '#d4d4d0',
    'text_muted': '#888880',
    'accent': '#7c9a6d',
    'accent_hover': '#8aaa7d',
    'error': '#d95555',
    'warning': '#d9aa55',
    'tip': '#7daea3',
    'info': '#6b8cae',
    'purple': '#a78bfa',
    'pink': '#f472b6',
}

# SCENARIOS - 30 comprehensive test cases
SCENARIOS = [
    # 1. Welcome / Onboarding
    {
        "name": "Welcome",
        "content": '''<trait:success>Welcome to Traitor IDE!</trait:success>

I'm your AI coding assistant. I can help you:

<trait:grid cols="2">
  <trait:card title="Explore">
    <trait:list ordered="false">
      <trait:item>Navigate codebase</trait:item>
      <trait:item>Find definitions</trait:item>
      <trait:item>Search patterns</trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Edit">
    <trait:list ordered="false">
      <trait:item>Refactor code</trait:item>
      <trait:item>Fix bugs</trait:item>
      <trait:item>Add features</trait:item>
    </trait:list>
  </trait:card>
</trait:grid>

<trait:button action="search" query="getting started">Get Started</trait:button>'''
    },

    # 2. Code Review with inline comments
    {
        "name": "Code Review",
        "content": '''Reviewed <trait:file path="/src/auth.ts" name="auth.ts" /> - Found 3 issues:

<trait:warning>Line 42: Missing input validation</trait:warning>

<trait:code file="/src/auth.ts" language="typescript" lineStart="40">
function login(user: string) {
  // TODO: Add validation
  return db.find(user);
}
</trait:code>

<trait:diff file="/src/auth.ts">
  function login(user: string) {
-   // TODO: Add validation
+   if (!user || user.length < 3) {
+     throw new Error('Invalid username');
+   }
    return db.find(user);
  }
</trait:diff>

<trait:button action="openFile" path="/src/auth.ts" line="40">Open auth.ts</trait:button>'''
    },

    # 3. Build Status Dashboard
    {
        "name": "Build Status",
        "content": '''<trait:grid cols="4">
  <trait:metric value="45" label="Tests" change="+3" />
  <trait:metric value="100%" label="Passing" />
  <trait:metric value="2.4s" label="Build Time" change="-0.3s" />
  <trait:metric value="0" label="Errors" />
</trait:grid>

<trait:terminal title="Build Output">
  <trait:command>npm run build</trait:command>
  <trait:output type="stdout">Building 247 files...</trait:output>
  <trait:output type="stdout">Optimizing chunks...</trait:output>
  <trait:output type="success">Build completed in 2.4s</trait:output>
</trait:terminal>

<trait:progress value="100" max="100" label="Build Progress" />'''
    },

    # 4. Git Status
    {
        "name": "Git Status",
        "content": '''<trait:breadcrumb>
  <trait:tag>main</trait:tag>
  <trait:tag>feature</trait:tag>
  <trait:tag>auth-redesign</trait:tag>
</trait:breadcrumb>

<trait:filetree root="Changes">
  <trait:folder name="Modified" expanded="true">
    <trait:file path="/src/auth.ts" name="auth.ts" />
    <trait:file path="/src/login.tsx" name="login.tsx" />
  </trait:folder>
  <trait:folder name="Staged" expanded="true">
    <trait:file path="/package.json" name="package.json" />
  </trait:folder>
</trait:filetree>

<trait:terminal title="Git Diff">
  <trait:command>git diff --stat</trait:command>
  <trait:output type="stdout"> src/auth.ts   | 45 +++++++++</trait:output>
  <trait:output type="stdout"> src/login.tsx | 12 +++++</trait:output>
</trait:terminal>'''
    },

    # 5. Error Debug
    {
        "name": "Error Debug",
        "content": '''<trait:error>Runtime Error: Cannot read property 'map' of undefined</trait:error>

Stack trace:

<trait:code file="/src/components/List.tsx" language="typescript">
const List = ({ items }) => {
  return items.map(item => <Item key={item.id} />);
};
</trait:code>

<trait:tip>Fix: Add null check before mapping</trait:tip>

<trait:diff file="/src/components/List.tsx">
  const List = ({ items }) => {
+   if (!items) return null;
    return items.map(item => <Item key={item.id} />);
  };
</trait:diff>'''
    },

    # 6. Performance Analysis
    {
        "name": "Performance",
        "content": '''<trait:chart title="Bundle Size Over Time">
  <trait:data label="Mon" value="245" />
  <trait:data label="Tue" value="267" />
  <trait:data label="Wed" value="289" />
  <trait:data label="Thu" value="256" />
  <trait:data label="Fri" value="234" />
</trait:chart>

<trait:grid cols="3">
  <trait:card title="Largest Files">
    <trait:list ordered="false">
      <trait:item>vendor.js (1.2MB)</trait:item>
      <trait:item>app.js (450KB)</trait:item>
      <trait:item>styles.css (89KB)</trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Suggestions">
    <trait:list ordered="false">
      <trait:item>Code split routes</trait:item>
      <trait:item>Lazy load images</trait:item>
      <trait:item>Tree shake lodash</trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Savings">
    <trait:list ordered="false">
      <trait:item>-450KB vendor</trait:item>
      <trait:item>-120KB images</trait:item>
      <trait:item>-89KB fonts</trait:item>
    </trait:list>
  </trait:card>
</trait:grid>'''
    },

    # 7. Search Results
    {
        "name": "Search Results",
        "content": '''<trait:search query="useEffect dependency" results="12" />

<trait:table>
  <trait:row header="true">
    <trait:cell>File</trait:cell>
    <trait:cell>Line</trait:cell>
    <trait:cell>Match</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell><trait:file path="/src/App.tsx" name="App.tsx" /></trait:cell>
    <trait:cell>42</trait:cell>
    <trait:cell>useEffect(() =&gt; {...}, [])</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell><trait:file path="/src/hooks.ts" name="hooks.ts" /></trait:cell>
    <trait:cell>15</trait:cell>
    <trait:cell>useEffect(fn, deps)</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell><trait:file path="/src/utils.ts" name="utils.ts" /></trait:cell>
    <trait:cell>89</trait:cell>
    <trait:cell>useEffect(() =&gt; {...})</trait:cell>
  </trait:row>
</trait:table>

<trait:button action="openFile" path="/src/App.tsx" line="42">Open First Match</trait:button>'''
    },

    # 8. API Integration Guide
    {
        "name": "API Guide",
        "content": '''<trait:info>Setting up API integration</trait:info>

Follow these steps:

<trait:todo title="Setup Steps">
  <trait:item done="true">Install dependencies</trait:item>
  <trait:item done="true">Create API client</trait:item>
  <trait:item done="false">Add error handling</trait:item>
  <trait:item done="false">Write tests</trait:item>
  <trait:item done="false">Add caching</trait:item>
</trait:todo>

<trait:code file="/src/api.ts" language="typescript">
import axios from 'axios';

export const api = axios.create({
  baseURL: '/api/v1',
  timeout: 5000
});
</trait:code>

<trait:button action="runCommand" command="npm test">Run Tests</trait:button>'''
    },

    # 9. Refactoring Plan
    {
        "name": "Refactoring",
        "content": '''<trait:card title="Refactoring Plan">
  <trait:list ordered="true">
    <trait:item>Extract shared utilities</trait:item>
    <trait:item>Convert to TypeScript</trait:item>
    <trait:item>Add unit tests</trait:item>
    <trait:item>Update documentation</trait:item>
  </trait:list>
</trait:card>

<trait:grid cols="2">
  <trait:metric value="12" label="Files to refactor" />
  <trait:metric value="~4h" label="Estimated time" />
</trait:grid>

<trait:diff file="/src/utils/helpers.ts">
+ export const formatDate = (date: Date): string => {
+   return date.toISOString().split('T')[0];
+ };
</trait:diff>

<trait:progress value="25" max="100" label="Refactoring Progress" />'''
    },

    # 10. Test Results
    {
        "name": "Test Results",
        "content": '''<trait:grid cols="4">
  <trait:metric value="156" label="Total" />
  <trait:metric value="152" label="Passed" />
  <trait:metric value="3" label="Failed" />
  <trait:metric value="1" label="Skipped" />
</trait:grid>

<trait:terminal title="Test Output">
  <trait:command>npm test</trait:command>
  <trait:output type="stdout">PASS src/auth.test.ts</trait:output>
  <trait:output type="stdout">PASS src/utils.test.ts</trait:output>
  <trait:output type="stderr">FAIL src/api.test.ts</trait:output>
  <trait:output type="error">Expected 200, got 404</trait:output>
  <trait:output type="success">Test Suites: 2 passed, 1 failed</trait:output>
</trait:terminal>

<trait:badge variant="warning">3 Tests Failing</trait:badge>'''
    },

    # 11. Code Navigation
    {
        "name": "Navigation",
        "content": '''<trait:breadcrumb>
  <trait:tag>src</trait:tag>
  <trait:tag>components</trait:tag>
  <trait:tag>forms</trait:tag>
  <trait:tag>LoginForm.tsx</trait:tag>
</trait:breadcrumb>

<trait:filetree root="Related Files">
  <trait:folder name="Components" expanded="true">
    <trait:file path="/src/components/Form.tsx" name="Form.tsx" />
    <trait:file path="/src/components/Input.tsx" name="Input.tsx" />
  </trait:folder>
  <trait:folder name="Hooks" expanded="true">
    <trait:file path="/src/hooks/useForm.ts" name="useForm.ts" />
    <trait:file path="/src/hooks/useAuth.ts" name="useAuth.ts" />
  </trait:folder>
</trait:filetree>

<trait:button action="search" query="form validation">Search Forms</trait:button>'''
    },

    # 12. Dependency Update
    {
        "name": "Dependencies",
        "content": '''<trait:card title="Outdated Dependencies">
  <trait:table>
    <trait:row header="true">
      <trait:cell>Package</trait:cell>
      <trait:cell>Current</trait:cell>
      <trait:cell>Latest</trait:cell>
      <trait:cell>Status</trait:cell>
    </trait:row>
    <trait:row>
      <trait:cell>react</trait:cell>
      <trait:cell>18.0.0</trait:cell>
      <trait:cell>18.2.0</trait:cell>
      <trait:cell><trait:badge variant="success">Minor</trait:badge></trait:cell>
    </trait:row>
    <trait:row>
      <trait:cell>typescript</trait:cell>
      <trait:cell>4.8.0</trait:cell>
      <trait:cell>5.0.0</trait:cell>
      <trait:cell><trait:badge variant="warning">Major</trait:badge></trait:cell>
    </trait:row>
  </trait:table>
</trait:card>

<trait:button action="runCommand" command="npm update">Update All</trait:button>'''
    },

    # 13. Documentation
    {
        "name": "Documentation",
        "content": '''<trait:tip>Documentation generated successfully</trait:tip>

<trait:grid cols="2">
  <trait:card title="API Docs">
    <trait:list ordered="false">
      <trait:item><trait:link href="/docs/api">REST API</trait:link></trait:item>
      <trait:item><trait:link href="/docs/graphql">GraphQL</trait:link></trait:item>
      <trait:item><trait:link href="/docs/webhooks">Webhooks</trait:link></trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Guides">
    <trait:list ordered="false">
      <trait:item><trait:link href="/docs/setup">Getting Started</trait:link></trait:item>
      <trait:item><trait:link href="/docs/auth">Authentication</trait:link></trait:item>
      <trait:item><trait:link href="/docs/deploy">Deployment</trait:link></trait:item>
    </trait:list>
  </trait:card>
</trait:grid>

<trait:progress value="85" max="100" label="Documentation Coverage" />'''
    },

    # 14. Security Audit
    {
        "name": "Security",
        "content": '''<trait:warning>2 vulnerabilities found</trait:warning>

<trait:terminal title="Security Report">
  <trait:command>npm audit</trait:command>
  <trait:output type="stdout">found 0 vulnerabilities</trait:output>
  <trait:output type="stderr">Critical: lodash prototype pollution</trait:output>
  <trait:output type="stderr">High: axios XSS vulnerability</trait:output>
</trait:terminal>

<trait:card title="Recommendations">
  <trait:list ordered="true">
    <trait:item>Update lodash to 4.17.21+</trait:item>
    <trait:item>Update axios to 1.6.0+</trait:item>
    <trait:item>Enable Dependabot alerts</trait:item>
  </trait:list>
</trait:card>'''
    },

    # 15. Database Schema
    {
        "name": "Database",
        "content": '''<trait:file path="/prisma/schema.prisma" name="schema.prisma" />

<trait:code file="/prisma/schema.prisma" language="prisma">
model User {
  id    Int     @id @default(autoincrement())
  email String  @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int    @id @default(autoincrement())
  title    String
  content  String
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
</trait:code>

<trait:button action="runCommand" command="npx prisma migrate dev">Run Migration</trait:button>'''
    },

    # 16. TypeScript Migration
    {
        "name": "TS Migration",
        "content": '''<trait:grid cols="3">
  <trait:metric value="45" label="Files" />
  <trait:metric value="28" label="Converted" />
  <trait:metric value="62%" label="Progress" />
</trait:grid>

<trait:todo title="Migration Tasks">
  <trait:item done="true">Setup tsconfig.json</trait:item>
  <trait:item done="true">Convert utilities</trait:item>
  <trait:item done="false">Convert components</trait:item>
  <trait:item done="false">Add strict mode</trait:item>
</trait:todo>

<trait:diff file="/src/utils.js">
- function add(a, b) {
+ function add(a: number, b: number): number {
    return a + b;
  }
</trait:diff>'''
    },

    # 17. Component Library
    {
        "name": "Components",
        "content": '''<trait:grid cols="3">
  <trait:card title="Buttons">
    <trait:list ordered="false">
      <trait:item>Primary</trait:item>
      <trait:item>Secondary</trait:item>
      <trait:item>Ghost</trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Inputs">
    <trait:list ordered="false">
      <trait:item>Text</trait:item>
      <trait:item>Number</trait:item>
      <trait:item>Select</trait:item>
    </trait:list>
  </trait:card>
  <trait:card title="Feedback">
    <trait:list ordered="false">
      <trait:item>Alert</trait:item>
      <trait:item>Toast</trait:item>
      <trait:item>Modal</trait:item>
    </trait:list>
  </trait:card>
</trait:grid>

<trait:button action="search" query="component">View All</trait:button>'''
    },

    # 18. Error Boundary
    {
        "name": "Error Boundary",
        "content": '''<trait:error>Component Error: Something went wrong</trait:error>

<trait:code file="/src/ErrorBoundary.tsx" language="typescript">
class ErrorBoundary extends React.Component {
  componentDidCatch(error, info) {
    logError(error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <Fallback />;
    }
    return this.props.children;
  }
}
</trait:code>

<trait:tip>Wrap problematic components with ErrorBoundary</trait:tip>

<trait:button action="openFile" path="/src/ErrorBoundary.tsx">Open File</trait:button>'''
    },

    # 19. Environment Config
    {
        "name": "Environment",
        "content": '''<trait:filetree root="Config Files">
  <trait:file path="/.env.local" name=".env.local" />
  <trait:file path="/.env.production" name=".env.production" />
  <trait:file path="/config/app.ts" name="app.ts" />
</trait:filetree>

<trait:code file="/.env.local">
DATABASE_URL=postgresql://localhost:5432/dev
API_KEY=sk_test_123
DEBUG=true
</trait:code>

<trait:warning>Never commit .env files to git</trait:warning>'''
    },

    # 20. Deployment Status
    {
        "name": "Deployment",
        "content": '''<trait:grid cols="3">
  <trait:metric value="v2.1.0" label="Version" />
  <trait:metric value="prod" label="Environment" />
  <trait:metric value="Healthy" label="Status" />
</trait:grid>

<trait:terminal title="Deploy Log">
  <trait:command>git push origin main</trait:command>
  <trait:output type="stdout">Building...</trait:output>
  <trait:output type="stdout">Uploading...</trait:output>
  <trait:output type="success">Deployed to production</trait:output>
</trait:terminal>

<trait:button action="runCommand" command="npm run deploy">Deploy</trait:button>'''
    },

    # 21. Code Metrics
    {
        "name": "Code Metrics",
        "content": '''<trait:chart title="Lines of Code">
  <trait:data label="Mon" value="1240" />
  <trait:data label="Tue" value="1350" />
  <trait:data label="Wed" value="1280" />
  <trait:data label="Thu" value="1420" />
  <trait:data label="Fri" value="1500" />
</trait:chart>

<trait:grid cols="4">
  <trait:metric value="1.2k" label="TypeScript" />
  <trait:metric value="450" label="CSS" />
  <trait:metric value="89" label="Tests" />
  <trait:metric value="12" label="Config" />
</trait:grid>'''
    },

    # 22. PR Template
    {
        "name": "Pull Request",
        "content": '''<trait:card title="PR #42: Auth Redesign">
  <trait:list ordered="false">
    <trait:item>Add JWT authentication</trait:item>
    <trait:item>Implement refresh tokens</trait:item>
    <trait:item>Add password reset flow</trait:item>
  </trait:list>
</trait:card>

<trait:table>
  <trait:row header="true">
    <trait:cell>Check</trait:cell>
    <trait:cell>Status</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>Tests passing</trait:cell>
    <trait:cell><trait:badge variant="success">Yes</trait:badge></trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>Code reviewed</trait:cell>
    <trait:cell><trait:badge variant="success">Yes</trait:badge></trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>Docs updated</trait:cell>
    <trait:cell><trait:badge variant="warning">Pending</trait:badge></trait:cell>
  </trait:row>
</trait:table>'''
    },

    # 23. Debug Session
    {
        "name": "Debug",
        "content": '''<trait:tip>Set breakpoint at line 42</trait:tip>

<trait:code file="/src/debug.ts" language="typescript" lineStart="40">
function processData(data) {
  debugger; // Break here
  return transform(data);
}
</trait:code>

<trait:terminal title="Debug Console">
  <trait:output type="stdout">data = Array(10) [1, 2, 3...]</trait:output>
  <trait:output type="stdout">result = Object {name: "test"}</trait:output>
</trait:terminal>

<trait:button action="runCommand" command="npm run debug">Start Debugger</trait:button>'''
    },

    # 24. Optimization
    {
        "name": "Optimization",
        "content": '''<trait:card title="Performance Improvements">
  <trait:list ordered="true">
    <trait:item>Code split routes (-450KB)</trait:item>
    <trait:item>Lazy load images (-120KB)</trait:item>
    <trait:item>Tree shake lodash (-89KB)</trait:item>
    <trait:item>Compress assets (-234KB)</trait:item>
  </trait:list>
</trait:card>

<trait:metric value="893KB" label="Before" />
<trait:metric value="0KB" label="Saved" change="-893KB" />

<trait:success>Total savings: 893KB (42%)</trait:success>'''
    },

    # 25. Feature Flags
    {
        "name": "Feature Flags",
        "content": '''<trait:table>
  <trait:row header="true">
    <trait:cell>Feature</trait:cell>
    <trait:cell>Status</trait:cell>
    <trait:cell>Users</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>New Dashboard</trait:cell>
    <trait:cell><trait:badge variant="success">Enabled</trait:badge></trait:cell>
    <trait:cell>100%</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>Dark Mode</trait:cell>
    <trait:cell><trait:badge variant="success">Enabled</trait:badge></trait:cell>
    <trait:cell>100%</trait:cell>
  </trait:row>
  <trait:row>
    <trait:cell>Beta API</trait:cell>
    <trait:cell><trait:badge variant="warning">Partial</trait:badge></trait:cell>
    <trait:cell>25%</trait:cell>
  </trait:row>
</trait:table>

<trait:button action="openFile" path="/src/config/features.ts">Edit Config</trait:button>'''
    },

    # 26. Analytics
    {
        "name": "Analytics",
        "content": '''<trait:chart title="Daily Active Users">
  <trait:data label="Mon" value="1240" />
  <trait:data label="Tue" value="1350" />
  <trait:data label="Wed" value="1890" />
  <trait:data label="Thu" value="1420" />
  <trait:data label="Fri" value="1650" />
</trait:chart>

<trait:grid cols="3">
  <trait:metric value="1.5k" label="DAU" change="+12%" />
  <trait:metric value="3.2" label="Pages/Session" />
  <trait:metric value="45s" label="Avg Duration" />
</trait:grid>'''
    },

    # 27. Hotfix
    {
        "name": "Hotfix",
        "content": '''<trait:error>Critical: Production error affecting payments</trait:error>

<trait:todo title="Hotfix Checklist">
  <trait:item done="true">Identify issue</trait:item>
  <trait:item done="true">Create fix</trait:item>
  <trait:item done="true">Test locally</trait:item>
  <trait:item done="false">Deploy to staging</trait:item>
  <trait:item done="false">Deploy to prod</trait:item>
</trait:todo>

<trait:diff file="/src/payment.ts">
- if (amount > 0) {
+ if (amount != null && amount > 0) {
    processPayment(amount);
  }
</trait:diff>

<trait:button action="runCommand" command="npm run deploy:prod">Deploy Hotfix</trait:button>'''
    },

    # 28. Onboarding Checklist
    {
        "name": "Onboarding",
        "content": '''<trait:success>Welcome to the team!</trait:success>

<trait:todo title="First Week">
  <trait:item done="true">Setup dev environment</trait:item>
  <trait:item done="true">Clone repositories</trait:item>
  <trait:item done="false">Read architecture docs</trait:item>
  <trait:item done="false">First code review</trait:item>
  <trait:item done="false">Deploy to staging</trait:item>
</trait:todo>

<trait:card title="Resources">
  <trait:list ordered="false">
    <trait:item><trait:file path="/docs/setup.md" name="Setup Guide" /></trait:item>
    <trait:item><trait:file path="/docs/architecture.md" name="Architecture" /></trait:item>
    <trait:item><trait:file path="/CONTRIBUTING.md" name="Contributing" /></trait:item>
  </trait:list>
</trait:card>'''
    },

    # 29. Code Review Summary
    {
        "name": "Review Summary",
        "content": '''<trait:grid cols="3">
  <trait:metric value="12" label="Files" />
  <trait:metric value="+450" label="Additions" />
  <trait:metric value="-120" label="Deletions" />
</trait:grid>

<trait:card title="Feedback">
  <trait:list ordered="false">
    <trait:item>Nice use of TypeScript generics</trait:item>
    <trait:item>Consider adding more tests</trait:item>
    <trait:item>Documentation looks good</trait:item>
  </trait:list>
</trait:card>

<trait:badge variant="success">Approved</trait:badge>

<trait:button action="runCommand" command="git merge">Merge PR</trait:button>'''
    },

    # 30. System Status
    {
        "name": "System Status",
        "content": '''<trait:grid cols="4">
  <trait:metric value="99.9%" label="Uptime" />
  <trait:metric value="45ms" label="Latency" />
  <trait:metric value="2%" label="CPU" />
  <trait:metric value="1.2GB" label="Memory" />
</trait:grid>

<trait:terminal title="System Health">
  <trait:command>docker ps</trait:command>
  <trait:output type="stdout">app: healthy</trait:output>
  <trait:output type="stdout">db: healthy</trait:output>
  <trait:output type="stdout">redis: healthy</trait:output>
  <trait:output type="success">All systems operational</trait:output>
</trait:terminal>

<trait:info>Last checked: <trait:timestamp value="2024-01-15T16:30:00Z" /></trait:info>'''
    },
]

# HTML TEMPLATE (same as before, but with gallery layout)
HTML_TEMPLATE = '''<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AML Widget Scenarios</title>
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
        
        h1 {{
            color: {accent};
            font-size: 24px;
            margin-bottom: 8px;
            font-weight: 600;
        }}
        
        .subtitle {{
            color: {text_muted};
            margin-bottom: 30px;
        }}
        
        .scenarios-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(500px, 1fr));
            gap: 20px;
        }}
        
        .scenario {{
            background: {bg_card};
            border: 1px solid {border};
            border-radius: 12px;
            overflow: hidden;
        }}
        
        .scenario-header {{
            padding: 12px 16px;
            background: {bg_header};
            border-bottom: 1px solid {border};
            display: flex;
            align-items: center;
            justify-content: space-between;
        }}
        
        .scenario-name {{
            font-weight: 600;
            color: {accent};
            font-size: 14px;
        }}
        
        .scenario-number {{
            color: {text_muted};
            font-size: 12px;
        }}
        
        .scenario-content {{
            padding: 16px;
        }}
        
        /* ALL WIDGET STYLES (same as before) */
        .trait-button {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            background: rgba(124, 154, 109, 0.12);
            border: 1px solid rgba(124, 154, 109, 0.2);
            border-radius: 6px;
            color: #7c9a6d;
            font-size: 12px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s;
            margin: 2px;
        }}
        
        .trait-button:hover {{
            background: rgba(124, 154, 109, 0.2);
            transform: translateY(-1px);
        }}
        
        .trait-code-block {{
            margin: 10px 0;
            border-radius: 8px;
            overflow: hidden;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        .trait-code-header {{
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 11px;
        }}
        
        .trait-code-file {{
            color: #7c9a6d;
            font-family: 'JetBrains Mono', monospace;
            cursor: pointer;
        }}
        
        .trait-code-file:hover {{
            text-decoration: underline;
        }}
        
        .trait-code-lang {{
            color: #5a5a52;
            text-transform: uppercase;
            font-size: 10px;
        }}
        
        .trait-code {{
            margin: 0;
            padding: 12px;
            font-family: 'JetBrains Mono', 'SF Mono', monospace;
            font-size: 12px;
            line-height: 1.5;
            color: #d4d4d0;
            overflow-x: auto;
        }}
        
        .trait-coderef {{
            display: inline;
            padding: 2px 8px;
            background: rgba(124, 154, 109, 0.1);
            border: 1px solid rgba(124, 154, 109, 0.15);
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #7c9a6d;
            cursor: pointer;
        }}
        
        .trait-diff {{
            margin: 10px 0;
            border-radius: 8px;
            overflow: hidden;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        .trait-diff-header {{
            padding: 8px 12px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 11px;
            color: #888880;
            font-family: 'JetBrains Mono', monospace;
        }}
        
        .trait-diff-line {{
            display: flex;
            padding: 2px 12px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        
        .trait-diff-added {{
            background: rgba(124, 154, 109, 0.08);
        }}
        
        .trait-diff-removed {{
            background: rgba(217, 85, 85, 0.08);
        }}
        
        .trait-diff-added .trait-diff-marker {{
            color: #7c9a6d;
        }}
        
        .trait-diff-removed .trait-diff-marker {{
            color: #d95555;
        }}
        
        .trait-diff-marker {{
            width: 16px;
            flex-shrink: 0;
            color: #5a5a52;
            user-select: none;
        }}
        
        .trait-diff-text {{
            color: #d4d4d0;
        }}
        
        .trait-file {{
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 10px;
            background: rgba(124, 154, 109, 0.08);
            border: 1px solid rgba(124, 154, 109, 0.12);
            border-radius: 4px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            color: #7c9a6d;
            cursor: pointer;
        }}
        
        .trait-list {{
            margin: 10px 0;
            padding-left: 24px;
            color: #d4d4d0;
        }}
        
        .trait-item {{
            margin: 4px 0;
            line-height: 1.5;
        }}
        
        .trait-todo {{
            margin: 10px 0;
            padding: 14px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
        }}
        
        .trait-todo-header {{
            margin-bottom: 12px;
            font-size: 11px;
            font-weight: 600;
            color: #888880;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .trait-todo-list {{
            list-style: none;
            margin: 0;
            padding: 0;
        }}
        
        .trait-todo-item {{
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 5px 0;
            font-size: 13px;
            color: #d4d4d0;
        }}
        
        .trait-todo-item input[type="checkbox"] {{
            accent-color: #7c9a6d;
            width: 14px;
            height: 14px;
        }}
        
        .trait-todo-done {{
            opacity: 0.5;
            text-decoration: line-through;
        }}
        
        .trait-table {{
            width: 100%;
            margin: 10px 0;
            border-collapse: collapse;
            font-size: 12px;
        }}
        
        .trait-row {{
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        .trait-row:last-child {{
            border-bottom: none;
        }}
        
        .trait-row-header th {{
            padding: 10px 12px;
            text-align: left;
            font-weight: 500;
            color: #888880;
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: rgba(26, 26, 24, 0.4);
        }}
        
        .trait-cell {{
            padding: 10px 12px;
            color: #d4d4d0;
        }}
        
        .trait-badge {{
            display: inline-flex;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            margin: 0 2px;
        }}
        
        .trait-badge-default {{
            background: rgba(124, 154, 109, 0.1);
            color: #888880;
        }}
        
        .trait-badge-success {{
            background: rgba(124, 154, 109, 0.15);
            color: #7c9a6d;
        }}
        
        .trait-badge-warning {{
            background: rgba(217, 170, 85, 0.15);
            color: #d9aa55;
        }}
        
        .trait-badge-error {{
            background: rgba(217, 85, 85, 0.15);
            color: #d95555;
        }}
        
        .trait-tag {{
            display: inline-flex;
            padding: 2px 8px;
            background: rgba(124, 154, 109, 0.08);
            border: 1px solid rgba(124, 154, 109, 0.12);
            border-radius: 4px;
            font-size: 11px;
            color: #888880;
            margin: 0 2px;
        }}
        
        .trait-progress {{
            margin: 10px 0;
        }}
        
        .trait-progress-label {{
            display: flex;
            justify-content: space-between;
            font-size: 11px;
            color: #888880;
            margin-bottom: 6px;
        }}
        
        .trait-progress-bar {{
            height: 6px;
            background: rgba(124, 154, 109, 0.1);
            border-radius: 3px;
            overflow: hidden;
        }}
        
        .trait-progress-fill {{
            height: 100%;
            background: linear-gradient(90deg, #7c9a6d, #8aaa7d);
            border-radius: 3px;
            transition: width 0.3s;
        }}
        
        .trait-metric {{
            display: inline-flex;
            flex-direction: column;
            padding: 14px 18px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
            min-width: 90px;
        }}
        
        .trait-metric-value {{
            font-size: 24px;
            font-weight: 700;
            color: #e8e8e6;
            line-height: 1;
        }}
        
        .trait-metric-label {{
            margin-top: 6px;
            font-size: 10px;
            color: #5a5a52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .trait-metric-change {{
            margin-top: 8px;
            font-size: 11px;
            font-weight: 500;
        }}
        
        .trait-metric-change-up {{
            color: #7c9a6d;
        }}
        
        .trait-metric-change-down {{
            color: #d95555;
        }}
        
        .trait-chart {{
            margin: 10px 0;
            padding: 14px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
        }}
        
        .trait-chart-title {{
            font-size: 11px;
            font-weight: 600;
            color: #888880;
            margin-bottom: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .trait-chart-content {{
            display: flex;
            align-items: flex-end;
            gap: 10px;
            height: 100px;
        }}
        
        .trait-chart-bar {{
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 24px;
            background: linear-gradient(180deg, #7c9a6d, #6a8a5d);
            border-radius: 3px 3px 0 0;
            transition: all 0.2s;
        }}
        
        .trait-chart-bar:hover {{
            filter: brightness(1.1);
        }}
        
        .trait-chart-bar-value {{
            margin-top: -18px;
            font-size: 10px;
            color: #e8e8e6;
            font-weight: 500;
        }}
        
        .trait-chart-bar-label {{
            margin-top: 6px;
            font-size: 10px;
            color: #5a5a52;
        }}
        
        .trait-terminal {{
            margin: 10px 0;
            border-radius: 8px;
            overflow: hidden;
            background: rgba(10, 10, 10, 0.9);
            border: 1px solid rgba(124, 154, 109, 0.08);
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        
        .trait-terminal-header {{
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        .trait-terminal-title {{
            font-size: 11px;
            color: #5a5a52;
        }}
        
        .trait-terminal-content {{
            padding: 12px;
            line-height: 1.6;
        }}
        
        .trait-command {{
            color: #7c9a6d;
        }}
        
        .trait-command::before {{
            content: '$ ';
            color: #5a5a52;
        }}
        
        .trait-output {{
            color: #d4d4d0;
        }}
        
        .trait-output-stderr {{
            color: #d9aa55;
        }}
        
        .trait-output-error {{
            color: #d95555;
        }}
        
        .trait-output-success {{
            color: #7c9a6d;
        }}
        
        .trait-alert {{
            display: flex;
            gap: 10px;
            padding: 12px 14px;
            margin: 10px 0;
            border-radius: 8px;
            font-size: 13px;
            line-height: 1.5;
            border-left: 3px solid;
        }}
        
        .trait-alert-icon {{
            flex-shrink: 0;
            font-size: 16px;
        }}
        
        .trait-alert-info {{
            background: rgba(107, 140, 174, 0.08);
            border-left-color: #6b8cae;
            color: #8aaec9;
        }}
        
        .trait-alert-warning {{
            background: rgba(217, 170, 85, 0.08);
            border-left-color: #d9aa55;
            color: #e4c078;
        }}
        
        .trait-alert-error {{
            background: rgba(217, 85, 85, 0.08);
            border-left-color: #d95555;
            color: #e08585;
        }}
        
        .trait-alert-success {{
            background: rgba(124, 154, 109, 0.1);
            border-left-color: #7c9a6d;
            color: #a8c49a;
        }}
        
        .trait-alert-tip {{
            background: rgba(125, 174, 163, 0.08);
            border-left-color: #7daea3;
            color: #9ac9c0;
        }}
        
        .trait-card {{
            margin: 10px 0;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
            overflow: hidden;
        }}
        
        .trait-card-title {{
            padding: 12px 14px;
            background: rgba(26, 26, 24, 0.6);
            border-bottom: 1px solid rgba(124, 154, 109, 0.08);
            font-size: 13px;
            font-weight: 600;
            color: #e8e8e6;
        }}
        
        .trait-card-content {{
            padding: 14px;
        }}
        
        .trait-grid {{
            display: grid;
            gap: 10px;
            margin: 10px 0;
        }}
        
        .trait-grid-item {{
            min-width: 0;
        }}
        
        .trait-divider {{
            margin: 14px 0;
            border: none;
            border-top: 1px solid rgba(124, 154, 109, 0.08);
        }}
        
        .trait-filetree {{
            margin: 10px 0;
            padding: 14px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
        }}
        
        .trait-filetree-header {{
            margin-bottom: 10px;
            font-size: 11px;
            color: #5a5a52;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }}
        
        .trait-folder {{
            margin: 3px 0;
        }}
        
        .trait-folder-header {{
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 4px;
            cursor: pointer;
            color: #d4d4d0;
        }}
        
        .trait-folder-header:hover {{
            background: rgba(124, 154, 109, 0.08);
        }}
        
        .trait-folder-children {{
            padding-left: 18px;
        }}
        
        .trait-search {{
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 14px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 8px;
            margin: 10px 0;
            font-size: 13px;
        }}
        
        .trait-search-query {{
            font-family: 'JetBrains Mono', monospace;
            color: #e8e8e6;
            font-weight: 500;
        }}
        
        .trait-search-results {{
            margin-left: auto;
            font-size: 12px;
            color: #5a5a52;
        }}
        
        .trait-breadcrumb {{
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: rgba(22, 22, 20, 0.8);
            border: 1px solid rgba(124, 154, 109, 0.08);
            border-radius: 6px;
            font-size: 13px;
            margin: 10px 0;
        }}
        
        .trait-breadcrumb-separator {{
            color: #3a3a38;
            font-weight: 300;
        }}
        
        .trait-timestamp {{
            font-size: 12px;
            color: #5a5a52;
            font-family: 'JetBrains Mono', monospace;
        }}
        
        .trait-link {{
            color: #7c9a6d;
            text-decoration: underline;
            cursor: pointer;
        }}
        
        .trait-link:hover {{
            color: #8aaa7d;
        }}
        
        .trait-text-content {{
            color: #d4d4d0;
            line-height: 1.6;
        }}
        
        .trait-text-content p {{
            margin: 0 0 10px 0;
        }}
        
        .trait-text-content p:last-child {{
            margin-bottom: 0;
        }}
    </style>
</head>
<body>
    <h1>AML Widget Scenarios</h1>
    <div class="subtitle">30 comprehensive test cases for IDE widgets</div>
    
    <div class="scenarios-grid">
        {scenarios}
    </div>
</body>
</html>'''


def parse_attrs(attr_str: str) -> dict:
    """Parse XML attributes"""
    attrs = {}
    for match in re.finditer(r'([\w-]+)=["\']([^"\']*)["\']', attr_str):
        attrs[match.group(1)] = match.group(2)
    return attrs


def render_widget(tag_name: str, attrs: dict, content: str) -> str:
    """Render a single widget - simplified version"""
    
    if tag_name == 'trait:button':
        return f'<span class="trait-button">{escape(content)}</span>'
    
    elif tag_name == 'trait:code':
        file_html = f'<span class="trait-code-file">{attrs.get("file", "")}</span>' if "file" in attrs else ""
        lang_html = f'<span class="trait-code-lang">{attrs.get("language", "")}</span>' if "language" in attrs else ""
        header = f'<div class="trait-code-header">{file_html}{lang_html}</div>' if file_html or lang_html else ""
        return f'<div class="trait-code-block">{header}<pre class="trait-code">{escape(content)}</pre></div>'
    
    elif tag_name == 'trait:coderef':
        text = attrs.get("text", attrs.get("path", ""))
        return f'<code class="trait-coderef">{escape(text)}</code>'
    
    elif tag_name == 'trait:diff':
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
    
    elif tag_name == 'trait:file':
        name = attrs.get("name", attrs.get("path", "").split('/')[-1])
        return f'<span class="trait-file">/{escape(name)}</span>'
    
    elif tag_name == 'trait:list':
        items = re.findall(r'<trait:item[^>]*>(.*?)</trait:item>', content, re.DOTALL)
        items_html = ''.join([f'<li class="trait-item">{escape(item.strip())}</li>' for item in items])
        tag = 'ol' if attrs.get('ordered') == 'true' else 'ul'
        return f'<{tag} class="trait-list">{items_html}</{tag}>'
    
    elif tag_name == 'trait:todo':
        items = re.findall(r'<trait:item\s+done="([^"]*)"[^>]*>(.*?)</trait:item>', content, re.DOTALL)
        items_html = ''.join([
            f'<li class="trait-todo-item {"trait-todo-done" if done == "true" else ""}"><input type="checkbox" {"checked" if done == "true" else ""} disabled> <span>{escape(text.strip())}</span></li>'
            for done, text in items
        ])
        title = f'<div class="trait-todo-header">{attrs.get("title", "Tasks")}</div>' if "title" in attrs else ""
        return f'<div class="trait-todo">{title}<ul class="trait-todo-list">{items_html}</ul></div>'
    
    elif tag_name == 'trait:table':
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
    
    elif tag_name == 'trait:badge':
        variant = attrs.get("variant", "default")
        return f'<span class="trait-badge trait-badge-{variant}">{escape(content)}</span>'
    
    elif tag_name == 'trait:tag':
        return f'<span class="trait-tag">{escape(content)}</span>'
    
    elif tag_name == 'trait:progress':
        value = int(attrs.get("value", 0))
        max_val = int(attrs.get("max", 100))
        pct = min(100, max(0, (value / max_val) * 100))
        label = attrs.get("label", f"{value}/{max_val}")
        return f'<div class="trait-progress"><div class="trait-progress-label"><span>{label}</span><span>{value}/{max_val}</span></div><div class="trait-progress-bar"><div class="trait-progress-fill" style="width: {pct}%"></div></div></div>'
    
    elif tag_name == 'trait:metric':
        change_html = ''
        if 'change' in attrs:
            direction = 'up' if attrs['change'].startswith('+') else 'down'
            change_html = f'<div class="trait-metric-change trait-metric-change-{direction}">{attrs["change"]}</div>'
        return f'<div class="trait-metric"><div class="trait-metric-value">{attrs.get("value", "")}</div><div class="trait-metric-label">{attrs.get("label", "")}</div>{change_html}</div>'
    
    elif tag_name in ('trait:chart', 'trait:barchart'):
        data_points = re.findall(r'<trait:data\s+label="([^"]*)"\s+value="([^"]*)"[^/]*/>', content)
        max_val = max([int(v) for _, v in data_points], default=1)
        bars_html = ''.join([
            f'<div class="trait-chart-bar" style="height: {max(15, (int(v)/max_val)*90)}%"><div class="trait-chart-bar-value">{v}</div><div class="trait-chart-bar-label">{l}</div></div>'
            for l, v in data_points
        ])
        title = f'<div class="trait-chart-title">{attrs.get("title", "")}</div>' if "title" in attrs else ""
        return f'<div class="trait-chart">{title}<div class="trait-chart-content">{bars_html}</div></div>'
    
    elif tag_name == 'trait:terminal':
        commands = re.findall(r'<trait:command[^>]*>(.*?)</trait:command>', content, re.DOTALL)
        outputs = re.findall(r'<trait:output\s+type="([^"]*)"[^>]*>(.*?)</trait:output>', content, re.DOTALL)
        cmd_html = ''.join([f'<div class="trait-command">{escape(cmd.strip())}</div>' for cmd in commands])
        out_html = ''.join([f'<div class="trait-output trait-output-{t}">{escape(o.strip())}</div>' for t, o in outputs])
        title = attrs.get("title", "Terminal")
        return f'<div class="trait-terminal"><div class="trait-terminal-header"><span class="trait-terminal-title">{title}</span></div><div class="trait-terminal-content">{cmd_html}{out_html}</div></div>'
    
    elif tag_name in ('trait:info', 'trait:warning', 'trait:error', 'trait:success', 'trait:tip'):
        icons = {'info': 'ℹ', 'warning': '⚠', 'error': '✕', 'success': '✓', 'tip': '💡'}
        return f'<div class="trait-alert trait-alert-{tag_name.split(":")[1]}"><span class="trait-alert-icon">{icons.get(tag_name.split(":")[1], "ℹ")}</span><span>{escape(content.strip())}</span></div>'
    
    elif tag_name == 'trait:card':
        title = f'<div class="trait-card-title">{escape(attrs.get("title", ""))}</div>' if "title" in attrs else ""
        inner = render_aml(content)
        return f'<div class="trait-card">{title}<div class="trait-card-content">{inner}</div></div>'
    
    elif tag_name == 'trait:grid':
        cols = attrs.get("cols", "3")
        children = render_aml(content)
        return f'<div class="trait-grid" style="grid-template-columns: repeat({cols}, 1fr);">{children}</div>'
    
    elif tag_name == 'trait:filetree':
        root = attrs.get("root", "Files")
        inner = render_aml(content)
        return f'<div class="trait-filetree"><div class="trait-filetree-header">{root}</div>{inner}</div>'
    
    elif tag_name == 'trait:folder':
        name = attrs.get("name", "folder")
        inner = render_aml(content)
        return f'<div class="trait-folder"><div class="trait-folder-header">▼ {escape(name)}</div><div class="trait-folder-children">{inner}</div></div>'
    
    elif tag_name == 'trait:search':
        query = attrs.get("query", "")
        results = attrs.get("results", "")
        res_html = f'<span class="trait-search-results">{results} results</span>' if results else ""
        return f'<div class="trait-search">🔍 <span class="trait-search-query">{escape(query)}</span>{res_html}</div>'
    
    elif tag_name == 'trait:breadcrumb':
        tags = re.findall(r'<trait:tag[^>]*>(.*?)</trait:tag>', content)
        items = [f'<span class="trait-tag">{escape(t)}</span>' for t in tags]
        sep = '<span class="trait-breadcrumb-separator">/</span>'
        return f'<div class="trait-breadcrumb">{sep.join(items)}</div>'
    
    elif tag_name == 'trait:timestamp':
        return f'<span class="trait-timestamp">{attrs.get("value", "")}</span>'
    
    elif tag_name == 'trait:link':
        return f'<span class="trait-link">{escape(content)}</span>'
    
    elif tag_name in ('trait:divider', 'trait:spacer', 'trait:br'):
        if tag_name == 'trait:divider':
            return '<hr class="trait-divider">'
        elif tag_name == 'trait:spacer':
            size = attrs.get("size", "12px")
            return f'<div style="height: {size}"></div>'
        return '<br>'
    
    return f'<span style="color: #d95555;">Unknown: {tag_name}</span>'


def render_aml(content: str) -> str:
    """Render AML content to HTML"""
    result = []
    pos = 0
    
    while pos < len(content):
        remaining = content[pos:]
        match = re.search(r'<(trait:[a-z]+)([^>]*)>', remaining, re.IGNORECASE)
        
        if not match:
            text = content[pos:].strip()
            if text:
                result.append(f'<div class="trait-text-content"><p>{escape(text)}</p></div>')
            break
        
        tag_start = pos + match.start()
        tag_name = match.group(1).lower()
        attrs_str = match.group(2)
        
        if tag_start > pos:
            text = content[pos:tag_start].strip()
            if text:
                result.append(f'<div class="trait-text-content"><p>{escape(text)}</p></div>')
        
        # Check self-closing
        if attrs_str.rstrip().endswith('/') or tag_name in ('trait:divider', 'trait:spacer', 'trait:br'):
            attrs = parse_attrs(attrs_str)
            result.append(render_widget(tag_name, attrs, ''))
            pos = tag_start + len(match.group(0))
            continue
        
        # Find closing tag with nesting support
        close_tag = f'</{tag_name}>'
        depth = 1
        search_pos = tag_start + len(match.group(0))
        
        while search_pos < len(content) and depth > 0:
            remaining = content[search_pos:]
            next_open = remaining.lower().find(f'<{tag_name}')
            next_close = remaining.lower().find(close_tag)
            
            if next_close == -1:
                break
            
            if next_open != -1 and next_open < next_close:
                depth += 1
                search_pos += next_open + len(tag_name) + 1
            else:
                depth -= 1
                if depth == 0:
                    inner_start = tag_start + len(match.group(0))
                    end_pos = search_pos + next_close + len(close_tag)
                    inner_content = content[inner_start:search_pos + next_close]
                    attrs = parse_attrs(attrs_str)
                    result.append(render_widget(tag_name, attrs, inner_content))
                    pos = end_pos
                    break
                search_pos += next_close + len(close_tag)
        else:
            result.append(escape(match.group(0)))
            pos = tag_start + len(match.group(0))
    
    return ''.join(result)


def main():
    scenarios_html = []
    
    for i, scenario in enumerate(SCENARIOS, 1):
        content_html = render_aml(scenario["content"])
        scenarios_html.append(f'''
        <div class="scenario">
            <div class="scenario-header">
                <span class="scenario-name">{scenario["name"]}</span>
                <span class="scenario-number">#{i}</span>
            </div>
            <div class="scenario-content">
                {content_html}
            </div>
        </div>
        ''')
    
    full_html = HTML_TEMPLATE.format(
        **COLORS, 
        scenarios='\n'.join(scenarios_html)
    )
    
    output_path = '/Users/mac/kimi-vscode/ide/aml_scenarios.html'
    with open(output_path, 'w') as f:
        f.write(full_html)
    
    print(f"✅ Generated {len(SCENARIOS)} scenarios")
    print(f"📄 Output: {output_path}")
    print(f"🌐 Open: file://{output_path}")


if __name__ == '__main__':
    main()
