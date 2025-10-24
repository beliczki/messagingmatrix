# CRITICAL: React Component Remounting Performance Issue

## 🚨 THIS ISSUE HAS HAPPENED **3 TIMES** - DON'T FORGET THIS! 🚨

**Date:** 2025-01-25
**Time Spent:** 3+ HOURS of debugging
**Symptom:** Component rebuilds/reloads on every state change (zoom, filter, etc.)

---

## The Problem

### Symptoms You'll See:
- Component appears to "reload" or "rebuild" on every interaction
- Console shows component UNMOUNT → MOUNT on every state change
- All React hooks reset (useState, useMemo, useCallback, etc.)
- Performance is terrible, laggy, unresponsive
- User sees visible "flashing" or "jumping" of content

### Real-World Example (Tree View Zoom):
```
User zooms → Component unmounts → Component remounts → Tree rebuilds from scratch → Visible lag
```

---

## Root Causes (IN ORDER OF LIKELIHOOD)

### 1. ⚠️ **COMPONENT DEFINED INSIDE ANOTHER COMPONENT'S RENDER** ⚠️

**THIS IS THE #1 CAUSE - CHECK THIS FIRST!**

```javascript
// ❌ WRONG - AuthenticatedApp is recreated on every App render
const App = () => {
  const [state, setState] = useState();

  const AuthenticatedApp = () => (  // ← NEW FUNCTION ON EVERY RENDER!
    <div>
      <MyComponent />
    </div>
  );

  return <Route element={<AuthenticatedApp />} />;
};
```

**Why this breaks:**
- Every time `App` re-renders, `AuthenticatedApp` becomes a NEW function
- React sees it as a different component type
- React UNMOUNTS the old component and MOUNTS the new one
- ALL state, hooks, and children are reset

**Fix:**
```javascript
// ✅ CORRECT - Inline the JSX directly
const App = () => {
  const [state, setState] = useState();

  return <Route element={
    <div>
      <MyComponent />
    </div>
  } />;
};

// OR move it outside:
const AuthenticatedApp = () => (
  <div>
    <MyComponent />
  </div>
);

const App = () => {
  return <Route element={<AuthenticatedApp />} />;
};
```

---

### 2. ⚠️ **DYNAMIC KEY PROP ON COMPONENT** ⚠️

```javascript
// ❌ WRONG - key changes on every state change
<MyComponent
  key={currentModule}  // ← Forces remount when currentModule changes
  state={state}
/>
```

**Why this breaks:**
- `key` prop tells React this is a different instance
- React unmounts old instance and mounts new one

**Fix:**
```javascript
// ✅ CORRECT - Remove key or use stable key
<MyComponent state={state} />
```

---

### 3. **REACT HOOKS DON'T SURVIVE REMOUNTS**

When a component remounts, ALL hooks reset:
- `useState` → Initial state
- `useRef` → New ref object
- `useMemo` → Recomputes
- `useCallback` → New function

**This breaks caching and performance optimizations!**

---

## The Solution Pattern

### Module-Level Persistent State

When React hooks fail due to remounting, use **module-level variables**:

```javascript
// ✅ Module-level cache survives component remounts
const persistentCache = {
  data: [],
  filteredData: [],
  lastComputedDeps: { filter: null, data: null }
};

const MyComponent = ({ filter, data }) => {
  // Update cache only when deps actually change
  if (persistentCache.lastComputedDeps.filter !== filter ||
      persistentCache.lastComputedDeps.data !== data) {
    console.log('Recomputing filtered data');
    persistentCache.filteredData = data.filter(item => item.includes(filter));
    persistentCache.lastComputedDeps = { filter, data };
  }

  const filteredData = persistentCache.filteredData;

  return <div>{filteredData.map(...)}</div>;
};
```

**Why this works:**
- Module-level variables persist for the lifetime of the JavaScript module
- Even if component unmounts/remounts, the cache remains
- Manual dependency tracking replaces useMemo

---

## Step-by-Step Debugging Guide

### 1. Add Mount/Unmount Logging

```javascript
useEffect(() => {
  console.log('🟢🟢🟢 COMPONENT MOUNTED');
  return () => console.log('🔴🔴🔴 COMPONENT UNMOUNTED');
}, []);
```

**Zoom/interact and check console:**
- If you see UNMOUNT → MOUNT on every interaction → **Component is remounting (BAD)**
- If you only see renders → **Component is just re-rendering (OK)**

---

### 2. Check for Inline Component Definitions

Search your code for:
```javascript
const ParentComponent = () => {
  const ChildComponent = () => ...  // ← FOUND IT!

  return <ChildComponent />;
};
```

**Fix:** Move `ChildComponent` outside `ParentComponent`

---

### 3. Check for Dynamic Keys

Search for:
```javascript
<Component key={someStateVariable} />
```

**Fix:** Remove the key prop unless absolutely necessary

---

### 4. Replace React Hooks with Module-Level Caching

If component keeps remounting and you can't fix the root cause:

```javascript
// Instead of useMemo:
const data = useMemo(() => expensiveComputation(), [dep]);

// Use module-level cache:
const cache = { result: null, lastDep: null };

const MyComponent = ({ dep }) => {
  if (cache.lastDep !== dep) {
    cache.result = expensiveComputation();
    cache.lastDep = dep;
  }
  const data = cache.result;
};
```

---

## Our Specific Fix (Tree View Zoom Issue)

### Changes Made:

1. **App.jsx** - Removed inline component definition
   ```javascript
   // Before:
   const AuthenticatedApp = () => (...);
   return <Route element={<AuthenticatedApp />} />;

   // After:
   return <Route element={...inline JSX...} />;
   ```

2. **Matrix.jsx** - Added module-level caching
   ```javascript
   const persistentMatrixRefs = {
     audiences: [],
     topics: [],
     messages: [],
     cachedFilteredAudiences: [],
     cachedFilteredAudiencesDeps: {}
   };
   ```

3. **useMatrix.js** - Module-level result caching
   ```javascript
   let cachedMatrixResult = null;

   export const useMatrix = () => {
     // Check if arrays actually changed
     if (cachedMatrixResult.audiences !== audiences) {
       cachedMatrixResult = { audiences, topics, ... };
     }
     return cachedMatrixResult;
   };
   ```

4. **Removed React.StrictMode** - Was causing double renders in development

---

## Quick Reference Checklist

When you see component "reloading" on every interaction:

- [ ] Add mount/unmount logging with useEffect
- [ ] Check if component defined inside another component's render
- [ ] Check for dynamic key props
- [ ] Check if parent component recreates often
- [ ] Replace useMemo/useCallback with module-level caching
- [ ] Use React.memo with custom comparison for child components
- [ ] Ensure prop references are stable (no inline objects/arrays/functions)

---

## Prevention Tips

1. **NEVER define components inside other components**
2. **NEVER use changing values as `key` props**
3. **For heavy computations, use module-level caching instead of useMemo if remounting is unavoidable**
4. **Always memoize inline objects/arrays in props:**
   ```javascript
   // ❌ Bad
   <Component data={[1, 2, 3]} />

   // ✅ Good
   const data = useMemo(() => [1, 2, 3], []);
   <Component data={data} />
   ```

---

## Additional Resources

- React DevTools Profiler - Shows which components are mounting/unmounting
- React DevTools Components - Highlight updates to see what's re-rendering
- `console.trace()` in render - See what's causing the render

---

## Final Notes

**THIS TOOK 3 HOURS TO DEBUG. DON'T LET IT HAPPEN AGAIN.**

The core lesson: **React hooks are amazing but they RESET on remount. If your component keeps remounting, fix the remount, don't fight it with more hooks.**

**Key insight:** Module-level variables > React hooks when dealing with remounting issues.

---

**Saved:** 2025-01-25
**Next time this happens:** Read this document FIRST before spending 3 hours debugging!
