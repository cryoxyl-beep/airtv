const fs = require('fs');
let code = fs.readFileSync('src/components/Navbar.tsx', 'utf-8');

code = code.replace(
  "w-[90px] md:w-[150px]",
  "w-[100px] md:w-[150px]"
);

fs.writeFileSync('src/components/Navbar.tsx', code);
