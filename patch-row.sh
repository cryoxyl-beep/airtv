cat /app/applet/src/components/Row.tsx | sed '/export const RowCard/i\
const visibilityListeners = new Map<Element, () => void>();\
let globalObserver: IntersectionObserver | null = null;\
\
const getGlobalObserver = () => {\
  if (typeof window === "undefined") return null;\
  if (!globalObserver) {\
    globalObserver = new IntersectionObserver(\
      (entries) => {\
        entries.forEach((entry) => {\
          if (entry.isIntersecting) {\
            const callback = visibilityListeners.get(entry.target);\
            if (callback) {\
              callback();\
              globalObserver?.unobserve(entry.target);\
              visibilityListeners.delete(entry.target);\
            }\
          }\
        });\
      },\
      { rootMargin: "200px" }\
    );\
  }\
  return globalObserver;\
};\
\
const observeElement = (element: Element, callback: () => void) => {\
  visibilityListeners.set(element, callback);\
  getGlobalObserver()?.observe(element);\
};\
\
const unobserveElement = (element: Element) => {\
  visibilityListeners.delete(element);\
  getGlobalObserver()?.unobserve(element);\
};\
' > /tmp/Row_new1.tsx
