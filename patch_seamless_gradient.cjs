const fs = require('fs');
let code = fs.readFileSync('/app/applet/src/components/WatchPlayer.tsx', 'utf8');

const targetGradientsRegex = /\{\/\* Layer 2: Gradients \*\/\}\s*<div className="absolute inset-x-0 bottom-0[^>]+>\s*<div className="absolute left-0 bottom-0[^>]+>/m;

const newGradients = `{/* Layer 2: Gradients */}
      <div
        className="absolute inset-0 pointer-events-none z-20"
        style={{
          background: \`
            linear-gradient(to top, rgba(11,11,11,0.9) 0%, rgba(11,11,11,0.55) 28%, rgba(11,11,11,0.15) 50%, transparent 65%),
            linear-gradient(to right, rgba(11,11,11,0.85) 0%, rgba(11,11,11,0.4) 30%, transparent 60%)
          \`,
        }}
      />`;

if (targetGradientsRegex.test(code)) {
  code = code.replace(targetGradientsRegex, newGradients);
  fs.writeFileSync('/app/applet/src/components/WatchPlayer.tsx', code);
  console.log("Gradients patched successfully.");
} else {
  console.log("Could not find gradient divs to replace.");
}
