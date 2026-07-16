import { Link } from 'react-router-dom';

const amcMenuItems = [
  { path: '/amc/dashboard', label: 'AMC Dashboard', icon: '📊' },
  { path: '/amc/list', label: 'All AMCs', icon: '📋' },
  { path: '/amc/create', label: 'Create AMC', icon: '➕' },
];

export function AmcMenuItems() {
  return (
    <>
      {amcMenuItems.map(item => (
        <Link 
          key={item.path} 
          to={item.path} 
          className="block px-4 py-2 hover:bg-gray-100"
        >
          {item.icon} {item.label}
        </Link>
      ))}
    </>
  );
}

export default amcMenuItems;