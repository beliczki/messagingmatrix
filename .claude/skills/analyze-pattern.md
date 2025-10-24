# Analyze Pattern Evaluation

This skill analyzes pattern evaluation for PMMID and trafficking fields.

## Purpose

Help debug or understand how patterns are being evaluated for auto-generated fields like PMMID, topic keys, and UTM parameters.

## Steps

1. Read current patterns from config.json:
   - PMMID pattern
   - Topic key pattern
   - Trafficking patterns (UTM fields)

2. Load sample data:
   - Read audiences from localStorage or sheets
   - Read messages from localStorage or sheets
   - Read topics from localStorage or sheets

3. Test pattern evaluation:
   - Use `src/utils/patternEvaluator.js` logic
   - Show how placeholders are replaced
   - Display expected vs actual output

4. Identify issues:
   - Missing fields in context
   - Incorrect placeholder syntax
   - Nested object access errors
   - Conditional expression bugs

5. Suggest pattern fixes or improvements

## Example Output

```
Current PMMID Pattern:
p_{{audiences[Audience_Key].Buying_platform}}-s_{{audiences[Audience_Key].Strategy}}-a_{{Audience_Key}}-m_{{Number}}-t_{{Topic_Key}}-v_{{Variant}}-n_{{Version}}

Sample Message Context:
- Audience_Key: "young_professionals"
- Number: 1
- Variant: "a"
- Version: 2
- Topic_Key: "product_launch"

Evaluated PMMID:
p_facebook-s_awareness-a_young_professionals-m_1-t_product_launch-v_a-n_2

Status: ✓ All placeholders resolved correctly
```
