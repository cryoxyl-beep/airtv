const fs = require('fs');
let code = fs.readFileSync('/tmp/Row_new1.tsx', 'utf8');

code = code.replace(/const observer = new IntersectionObserver\([\s\S]*?\}, \[\]\);/m, `
    if (cardRef.current) {
      observeElement(cardRef.current, () => {
        setIsVisible(true);
      });
    }
    return () => {
      if (cardRef.current) {
        unobserveElement(cardRef.current);
      }
    };
  }, []);`);

fs.writeFileSync('/app/applet/src/components/Row.tsx', code);
