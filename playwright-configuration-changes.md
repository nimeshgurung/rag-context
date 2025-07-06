# Playwright Configuration Changes for Web Scrape Source Dialog

## Summary of Changes

This document outlines the modifications made to the playwright configuration in the "Add Web Scrape Source" dialog to enhance functionality by adding pre-execution steps and improving code selection capabilities.

## Changes Made

### 1. Type Definitions (`src/lib/types.ts`)

**Modified `WebScrapeSource` interface:**
- **Removed**: `linkSelector` - Previously used for navigation link selection
- **Added**: `codeSelector` - CSS selector for extracting code snippets (optional)
- **Added**: `preExecutionSteps` - JavaScript code to execute before scraping (optional)

```typescript
export type WebScrapeSource = {
  type: 'web-scrape';
  name: string;
  description: string;
  startUrl: string;
  config: {
    contentSelector?: string;
    codeSelector?: string;      // NEW: Custom code selector
    maxDepth?: number;
    preExecutionSteps?: string; // NEW: Pre-execution JavaScript
  };
};
```

### 2. Frontend Dialog (`frontend/src/components/AddDocsModal.tsx`)

**UI Changes:**
- **Removed**: "Navigation Link Selector" field
- **Added**: "Code CSS Selector" field with helpful examples
- **Added**: "Pre-Execution Steps" field (multi-line textarea)

**State Management:**
- Removed `linkSelector` state variable
- Added `codeSelector` state variable  
- Added `preExecutionSteps` state variable

**Form Validation:**
- Updated form submission to include new fields
- Added proper cleanup of new state variables

### 3. Crawler Implementation (`src/lib/crawl/crawler.ts`)

**Pre-Execution Steps:**
- Added logic to execute JavaScript code before scraping each page
- Includes error handling for failed pre-execution steps
- Adds 1-second wait after execution to allow dynamic content to load
- Provides progress feedback via events

**Code Selection:**
- Updated to use `codeSelector` if provided, otherwise defaults to `pre > code`
- Improved code snippet extraction flexibility

**Link Crawling:**
- Simplified to use default `'a'` selector since custom navigation selector was removed
- Maintains same-hostname crawling strategy

**Error Handling:**
- Added proper TypeScript error handling for unknown error types
- Improved logging and progress messages

## Key Features

### Pre-Execution Steps
The new `preExecutionSteps` field allows users to provide JavaScript code that will be executed on each page before scraping. This enables:

- **Revealing Hidden Content**: Click buttons, expand sections, or trigger events to expose hidden documentation
- **Dynamic Content Loading**: Wait for or trigger lazy-loaded content
- **Authentication**: Handle login forms or accept cookies
- **Navigation**: Click through tabs or accordions to access content

**Example Pre-Execution Steps:**
```javascript
// Click to expand all code examples
document.querySelectorAll('.expand-code').forEach(btn => btn.click());

// Accept cookies banner
const cookieBtn = document.querySelector('.accept-cookies');
if (cookieBtn) cookieBtn.click();

// Wait for dynamic content
await new Promise(resolve => setTimeout(resolve, 2000));
```

### Code Selector
The `codeSelector` field allows users to specify custom CSS selectors for extracting code snippets, providing more flexibility than the default `pre > code` selector.

**Examples:**
- `.code-block` - For custom code block classes
- `pre code, .highlight` - Multiple selectors
- `[data-language="javascript"]` - Language-specific code blocks

## Migration Notes

### Backward Compatibility
- Existing web scrape sources will continue to work
- The `linkSelector` field is no longer used but won't cause errors
- Default behavior is maintained for code selection

### Database Impact
- No database schema changes required
- New fields are optional and stored in the existing config JSON

## Testing

Both frontend and backend code have been tested for:
- ✅ TypeScript compilation
- ✅ Build processes
- ✅ Error handling
- ✅ Backward compatibility

## Usage Instructions

1. **Open the Add Documentation Source dialog**
2. **Select the "Web Scrape" tab**
3. **Fill in the required fields** (Library Name, Description, Start URL)
4. **Optional: Add Code CSS Selector** for custom code extraction
5. **Optional: Add Pre-Execution Steps** for dynamic content handling
6. **Submit** to start crawling with the new configuration

The crawler will now execute any provided pre-execution steps before scraping each page, giving you more control over how content is accessed and extracted.