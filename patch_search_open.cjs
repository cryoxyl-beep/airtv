const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/Hero.tsx', 'utf8');

code = code.replace(
  'w-11 h-11 md:w-12 md:h-12 hover:w-64 md:hover:w-[320px] focus-within:w-64 md:focus-within:w-[320px]',
  'w-64 md:w-[320px] h-11 md:h-12'
);

code = code.replace(
  'cursor-pointer focus-within:cursor-text hover:shadow-2xl',
  'cursor-text hover:shadow-2xl'
);

code = code.replace(
  'w-full pl-5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-300 delay-100',
  'w-full pl-5 opacity-100'
);

fs.writeFileSync('/app/applet/src/components/Hero.tsx', code);
console.log("Patched search bar to open by default");
