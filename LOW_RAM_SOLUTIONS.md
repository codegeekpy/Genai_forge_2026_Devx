# Low RAM System - Alternative Solutions

If `tinyllama` still doesn't work due to low RAM (< 1GB available), here are your options:

## Option 1: Use Cloud-Based LLM (Recommended for Low RAM) ⭐

Use **Groq API** - it's FREE and very fast!

### Setup:

1. **Get FREE API key**: https://console.groq.com (takes 2 minutes)

2. **Add to `.env` file**:
   ```bash
   echo "GROQ_API_KEY=your_api_key_here" >> .env
   ```

3. **Update `main.py`** (line 56):
   ```python
   # Replace this line:
   from llm_extractor import LLMExtractor
   llm_extractor = LLMExtractor(model="tinyllama:latest")
   
   # With this:
   from groq_extractor import GroqLLMExtractor
   llm_extractor = GroqLLMExtractor()
   ```

4. **Install dependency**:
   ```bash
   # httpx is already in requirements.txt
   ```

5. **Restart server** and it works! Zero RAM usage on your system.

---

## Option 2: Free More RAM

Close unnecessary applications:
```bash
# Check what's using RAM
ps aux --sort=-%mem | head -20

# Kill heavy processes you don't need
```

---

## Option 3: Use Swap Memory

Enable more swap space (slower but works):
```bash
# Check current swap
free -h

# Add 4GB swap file (if needed)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

---

## Comparison:

| Solution | RAM Usage | Speed | Cost | Setup |
|----------|-----------|-------|------|-------|
| **Groq API** | 0 MB | ⚡⚡⚡⚡⚡ | FREE | 2 min |
| tinyllama | 637 MB | ⚡⚡ | Free | 5 min |
| Add RAM | N/A | ⚡⚡⚡⚡ | $ | Hardware |

---

## Recommended: Groq API

For your system (only 622MB available RAM), **Groq API is the best choice**:
- ✅ Zero RAM usage
- ✅ Much faster than local models
- ✅ Free tier (100,000 tokens/day)
- ✅ Better extraction quality
- ✅ No installation needed

The `groq_extractor.py` file is already created and ready to use!
