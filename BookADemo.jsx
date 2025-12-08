// import React, { useState } from 'react';
// const apiUrl = import.meta.env.VITE_API_URL;

// const BookADemo = () => {
//   const [formData, setFormData] = useState({
//     name: '',
//     email: '',
//     contactNumber: '',
//     location: '',
//     message: '',
//     organization: ''
//   });

//   const [isSubmitting, setIsSubmitting] = useState(false);

//   const handleInputChange = (e) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({
//       ...prev,
//       [name]: value
//     }));
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setIsSubmitting(true);

//     try {
//       const response = await fetch(`${apiUrl}/api/demo/book`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//   },
//   body: JSON.stringify(formData)
// });


//       if (response.ok) {
//         alert('Thank you! Your demo request has been submitted successfully. Our team will contact you soon.');
//         setFormData({
//           name: '',
//           email: '',
//           contactNumber: '',
//           location: '',
//           message: '',
//           organization: ''
//         });
//       } else {
//         throw new Error('Failed to submit demo request');
//       }
//     } catch (error) {
//       console.error('Error submitting demo request:', error);
//       alert('Sorry, there was an error submitting your request. Please try again.');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gray-50 pt-20">
//       <div className="max-w-md mx-auto px-6 py-16">
//         <div className="bg-white rounded-2xl shadow-lg p-8">
//           <div className="text-center mb-8">
//             <h1 className="text-3xl font-bold bg-gradient-to-r from-[#01c2cc] to-[#7a2de7] bg-clip-text text-transparent">
//               Enquire Now
//             </h1>
//             <p className="text-gray-600 mt-2">Fill out the form below to enquire about our products and services</p>
//           </div>

//           <form onSubmit={handleSubmit} className="space-y-6">
//             <div>
//               <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
//                 Name
//               </label>
//               <input
//                 type="text"
//                 id="name"
//                 name="name"
//                 value={formData.name}
//                 onChange={handleInputChange}
//                 required
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
//                 placeholder="Enter your name"
//               />
//             </div>

//             <div>
//               <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
//                 Email
//               </label>
//               <input
//                 type="email"
//                 id="email"
//                 name="email"
//                 value={formData.email}
//                 onChange={handleInputChange}
//                 required
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
//                 placeholder="Enter your email"
//               />
//             </div>

//             <div>
//               <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-2">
//                 Contact Number
//               </label>
//               <input
//                 type="tel"
//                 id="contactNumber"
//                 name="contactNumber"
//                 value={formData.contactNumber}
//                 onChange={handleInputChange}
//                 required
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
//                 placeholder="Enter your phone"
//               />
//             </div>

//             <div>
//               <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
//                 Location/City
//               </label>
//               <input
//                 type="text"
//                 id="location"
//                 name="location"
//                 value={formData.location}
//                 onChange={handleInputChange}
//                 required
//                 className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
//                 placeholder="Enter your city"
//               />
//             </div>

//             <button
//               type="submit"
//               disabled={isSubmitting}
//               className="w-full bg-gradient-to-r from-[#01c2cc] to-[#7a2de7] text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50"
//             >
//               {isSubmitting ? 'Submitting...' : 'Submit'}
//             </button>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default BookADemo;

import React, { useState } from 'react';
const apiUrl = import.meta.env.VITE_API_URL;

const BookADemo = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    contactNumber: '',
    location: '',
    message: '',
    organization: '',
    product: '',
    otherProduct: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        ...formData,
        // If user selected "Other", send the otherProduct text instead of blank
        product:
          formData.product === 'Other' && formData.otherProduct
            ? formData.otherProduct
            : formData.product
      };

      const response = await fetch(`${apiUrl}/api/demo/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Thank you! Your demo request has been submitted successfully. Our team will contact you soon.');
        setFormData({
          name: '',
          email: '',
          contactNumber: '',
          location: '',
          message: '',
          organization: '',
          product: '',
          otherProduct: ''
        });
      } else {
        throw new Error('Failed to submit demo request');
      }
    } catch (error) {
      console.error('Error submitting demo request:', error);
      alert('Sorry, there was an error submitting your request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="max-w-md mx-auto px-6 py-16">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#01c2cc] to-[#7a2de7] bg-clip-text text-transparent">
              Enquire Now
            </h1>
            <p className="text-gray-600 mt-2">Fill out the form below to enquire about our products and services</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
                placeholder="Enter your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="contactNumber" className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number
              </label>
              <input
                type="tel"
                id="contactNumber"
                name="contactNumber"
                value={formData.contactNumber}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
                placeholder="Enter your phone"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location/City
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
                placeholder="Enter your city"
              />
            </div>

            {/* Product select */}
            <div>
              <label htmlFor="product" className="block text-sm font-medium text-gray-700 mb-2">
                Select Product
              </label>
              <select
                id="product"
                name="product"
                value={formData.product}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
              >
                <option value="" disabled>
                  -- Select a product --
                </option>
                <option value="Bull's Eye">Bull's Eye</option>
                <option value="Fetal Therapy/Fetal Intervention Skill Lab">Fetal Therapy/Fetal Intervention Skill Lab</option>
                <option value="Radiation Free CT Simulator">Radiation Free CT Simulator</option>
                <option value="MSK Intervention Series">MSK Intervention Series</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* If Other selected, show text input to specify */}
            {formData.product === 'Other' && (
              <div>
                <label htmlFor="otherProduct" className="block text-sm font-medium text-gray-700 mb-2">
                  Please specify
                </label>
                <input
                  type="text"
                  id="otherProduct"
                  name="otherProduct"
                  value={formData.otherProduct}
                  onChange={handleInputChange}
                  required={formData.product === 'Other'}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#01c2cc] focus:border-transparent"
                  placeholder="Specify the product"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-gradient-to-r from-[#01c2cc] to-[#7a2de7] text-white py-3 px-6 rounded-lg font-semibold hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default BookADemo;
