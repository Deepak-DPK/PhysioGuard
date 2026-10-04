export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizes = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' };
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className={`${sizes[size]} animate-spin rounded-full border-4 border-gray-200 border-t-primary-600`} />
      {text && <p className="mt-3 text-sm text-gray-500">{text}</p>}
    </div>
  );
}
