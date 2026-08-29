const fs = require('fs');
let code = fs.readFileSync('src/pages/WatchPage.tsx', 'utf-8');

const target = `          try {
            const season = await fetchTVSeason(parseInt(id), targetSeason);
            setSeasonData(season);
          } catch (e: any) {
            console.error("fetchTVSeason failed:", e);
          }
        }
      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } catch (err: any) { console.error("Failed", err); setError(true); } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }`;
      
const replacement = `          try {
            const season = await fetchTVSeason(parseInt(id), targetSeason);
            setSeasonData(season);
          } catch (e: any) {
            console.error("fetchTVSeason failed:", e);
          }
        }
      } catch (err: any) {
        console.error("Failed to load watch data:", err.message || err);
        setError(true);
      } finally {
        if (!isRedirecting) {
          setLoading(false);
        }
      }`;

code = code.replace(target, replacement);
fs.writeFileSync('src/pages/WatchPage.tsx', code);
