"use client";

const TableSkeleton = ({ rows = 5, cols = 6, showSelection = true }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 last:border-0">
          {/* Checkbox Skeleton (First Column) */}
          {showSelection && (
            <td className="px-1 py-3.5 w-[35px] min-w-[35px] max-w-[35px] sticky left-0 bg-white border-r border-slate-200 text-center">
              <div className="w-3 h-3 bg-slate-100 rounded animate-pulse mx-auto" />
            </td>
          )}

          {/* Data Columns Skeleton */}
          {Array.from({ length: cols }).map((__, j) => (
            <td 
              key={j} 
              className="px-3 py-3.5 border-r border-slate-100 last:border-r-0"
            >
              <div 
                className="h-3.5 bg-slate-100 rounded-full animate-pulse"
                // Har cell ki width thodi alag rakhte hain taaki natural lage
                style={{ width: `${60 + (i * j % 5) * 10}%`, maxWidth: '120px' }} 
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export default TableSkeleton;