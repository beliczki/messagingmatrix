# Optimize Performance

This skill analyzes and optimizes application performance.

## Purpose

Identify performance bottlenecks and suggest optimizations.

## Areas to Analyze

### 1. Data Loading & State Management
- Check message index size (should be O(1) lookup)
- Verify localStorage size (limit: ~5MB)
- Check for unnecessary re-renders
- Analyze useEffect dependencies
- Look for missing useCallback/useMemo

### 2. Google Sheets Operations
- Check batch size for reads/writes
- Verify token caching (1 hour)
- Look for redundant API calls
- Check error handling and retries

### 3. Asset Management
- Verify virtual scrolling implementation
- Check image size optimization
- Analyze masonry layout calculations
- Look for lazy loading opportunities

### 4. Template Rendering
- Check iframe rendering performance
- Verify template caching
- Look for unnecessary template regeneration
- Check CSS loading strategy

### 5. React Component Performance
- Profile component render times
- Check for prop drilling
- Verify key usage in lists
- Look for unnecessary component nesting

## Common Issues to Check

1. **Large Message Sets**:
   - More than 1000 messages may slow down matrix rendering
   - Suggest pagination or virtual scrolling

2. **Asset Library**:
   - Check if all assets are loaded at once
   - Verify virtual scrolling chunk size
   - Check image dimensions (suggest optimization)

3. **State Updates**:
   - Look for rapid state updates (should debounce)
   - Check for batched updates
   - Verify React 18 automatic batching

4. **API Calls**:
   - Check for waterfall requests
   - Suggest parallel requests where possible
   - Verify caching strategy

5. **Bundle Size**:
   - Check Vite build output
   - Look for large dependencies
   - Suggest code splitting if needed

## Output

Provide:
- List of performance issues found
- Priority ranking (high/medium/low)
- Specific code locations to fix
- Suggested optimizations with code examples
- Estimated performance improvement
