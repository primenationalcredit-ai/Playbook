# Reviews.jsx: a thrown failure during Add Review only logged to the browser
# console - the consultant saw nothing and believed the review saved
# (Carlos/Oseiboakye ticket). Make every failure path show on screen.
import sys
f = 'src/pages/Reviews.jsx'
s = open(f, encoding='utf-8', errors='surrogateescape').read()
old = """    } catch (error) {
      console.error('Error adding review:', error);
    }
  };
  const handleDelete = async (reviewId) => {"""
new = """    } catch (error) {
      console.error('Error adding review:', error);
      alert('Error adding review - it was NOT saved: ' + (error && error.message ? error.message : error) + '\\nPlease try again, and report it if this keeps happening.');
    }
  };
  const handleDelete = async (reviewId) => {"""
n = s.count(old)
if n != 1:
    print(f"ABORT: anchor x{n}"); sys.exit(1)
s = s.replace(old, new, 1)
open(f, 'w', encoding='utf-8', errors='surrogateescape', newline='').write(s)
print("ADD-REVIEW FAILURES NOW ALERT ON SCREEN")
