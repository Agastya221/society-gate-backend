import { motion } from 'framer-motion';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';

export default function Amenities() {
  const amenities = [
    { id: 1, name: 'Swimming Pool', image: 'https://images.unsplash.com/photo-1576013551627-0cc20b96c2a7?auto=format&fit=crop&q=80&w=500', location: 'Clubhouse Ground Floor', open: '6 AM - 10 PM' },
    { id: 2, name: 'Gymnasium', image: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&q=80&w=500', location: 'Clubhouse 1st Floor', open: '5 AM - 11 PM' },
    { id: 3, name: 'Badminton Court', image: 'https://images.unsplash.com/photo-1626224583764-8478ab2e1ed9?auto=format&fit=crop&q=80&w=500', location: 'Block C Basement', open: '6 AM - 10 PM' },
    { id: 4, name: 'Party Hall', image: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&q=80&w=500', location: 'Clubhouse 2nd Floor', open: '24 Hours' },
  ];

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Amenities</h1>

      <div className="space-y-6">
        {amenities.map((amenity, index) => (
          <motion.div
            key={amenity.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="overflow-hidden group">
               <div className="h-40 w-full relative overflow-hidden">
                   <img 
                    src={amenity.image} 
                    alt={amenity.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                   <h3 className="absolute bottom-3 left-4 text-white font-bold text-xl">{amenity.name}</h3>
               </div>
               
               <div className="p-4">
                  <div className="flex items-center text-gray-600 text-sm mb-2">
                       <MapPin size={16} className="mr-2 text-indigo-500" />
                       {amenity.location}
                  </div>
                  <div className="flex items-center text-gray-600 text-sm mb-4">
                       <Clock size={16} className="mr-2 text-indigo-500" />
                       {amenity.open}
                  </div>

                  <Button fullWidth variant="primary">
                      <Calendar size={18} className="mr-2" /> Book Slot
                  </Button>
               </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
