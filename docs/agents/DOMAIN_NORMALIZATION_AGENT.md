# Domain Normalization Agent

## Overview
Comprehensive domain testing and edge case handling for domain normalization logic.

## Purpose
Ensure robust domain handling across various formats and edge cases.

## What It Does

### Test Categories

1. **Normalization Tests**
   - Basic domain formats
   - Protocol removal (http/https)
   - www. prefix handling
   - Path and query string removal
   - Trailing slashes and dots
   - Subdomain handling
   - Complex TLDs (co.uk, com.au)
   - Case normalization

2. **Edge Case Tests**
   - Punycode domains
   - Multi-level subdomains
   - Very long domains
   - Numeric domains
   - Hyphenated domains
   - International domains

3. **Domain Matching Tests**
   - www. and non-www. variations
   - Case-insensitive matching
   - Subdomain matching

## Usage

### Run Locally
```bash
npm run domain:test
```

### Programmatic Usage
```typescript
import { runDomainNormalizationTests } from './scripts/domain-normalization-agent';

const report = await runDomainNormalizationTests();
console.log(`Passed: ${report.summary.passed}/${report.summary.total}`);
```

## Output

### Test Report
- Total tests
- Passed/failed counts
- Edge case issues
- Failed test details
- Exit code: 0 (all passed) or 1 (failed)

## Examples

### All Tests Passed
```
📊 Domain Normalization Report:
Total Tests: 38
Passed: 38
Failed: 0
Edge Case Issues: 0
```

### Some Tests Failed
```
📊 Domain Normalization Report:
Total Tests: 38
Passed: 35
Failed: 3
Edge Case Issues: 2

❌ Failed Tests:
  • https://www.example.com/path?query=value
    Expected: example.com, Got: example.com/path
  • EXAMPLE.COM
    Expected: example.com, Got: EXAMPLE.COM
  • example.com:80
    Expected: example.com, Got: example.com:80

⚠️  Edge Case Issues:
  • xn--n3h.com: Normalized domain contains protocol
  • very-long-domain-name-that-should-still-work.example.com: Error during normalization
```

## Test Cases

### Basic Cases
- `example.com` → `example.com`
- `www.example.com` → `example.com`
- `http://example.com` → `example.com`
- `https://example.com` → `example.com`

### Paths and Query Strings
- `example.com/path` → `example.com`
- `example.com/path/to/page` → `example.com`
- `example.com?query=value` → `example.com`
- `example.com/path?query=value` → `example.com`

### Trailing Characters
- `example.com/` → `example.com`
- `example.com.` → `example.com`
- `www.example.com.` → `example.com`

### Subdomains
- `subdomain.example.com` → `subdomain.example.com`
- `www.subdomain.example.com` → `subdomain.example.com`
- `https://subdomain.example.com` → `subdomain.example.com`

### Complex TLDs
- `example.co.uk` → `example.co.uk`
- `www.example.co.uk` → `example.co.uk`
- `example.com.au` → `example.com.au`

### Case Normalization
- `EXAMPLE.COM` → `example.com`
- `Example.Com` → `example.com`

### Edge Cases
- Punycode: `xn--n3h.com`
- Multi-level: `sub.subdomain.example.com`
- Numeric: `123example.com`, `example123.com`
- Hyphenated: `example-123.com`
- Very long domains
- Port numbers: `example.com:80`

## Validation Rules

### Valid Normalized Domain
- ✅ No protocols (http://, https://)
- ✅ No paths (/path)
- ✅ No query strings (?query=value)
- ✅ No ports (:80, :443)
- ✅ Lowercase
- ✅ No trailing dots or slashes
- ✅ www. removed (for matching)

### Domain Matching
- `example.com` and `www.example.com` should match
- Case-insensitive matching
- Protocol/path differences ignored

## Integration with Other Agents
- Used by **Cache Validation Agent** for domain matching tests
- Feeds into **Data Quality Agent** for domain format validation
- Informs **Error Pattern Analysis Agent** about normalization issues

## Best Practices
1. Run after domain normalization changes
2. Test with real-world domains
3. Add new edge cases as discovered
4. Monitor for normalization bugs
5. Validate matching logic regularly

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Protocol not removed | Update normalizeDomain() to strip protocols |
| Path not removed | Add path removal logic |
| Case not normalized | Ensure toLowerCase() is called |
| www. not handled | Add www. removal logic |
| Port not removed | Add port removal regex |

---

*Part of Phase 3: Nice to Have Agents*

