const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: './config.env' });

const { pool, testConnection, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware

// Middleware

// ---------------- CORS FIX -----------------

// read allowed origins from config.env
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

// add fallback defaults
allowedOrigins.push("https://onesimulation.co.in");
allowedOrigins.push("https://www.onesimulation.co.in");

console.log("Allowed Origins:", allowedOrigins);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);  // Postman / curl etc allowed

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.log("❌ CORS BLOCKED:", origin);
    return callback(new Error("CORS not allowed"));
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

// apply CORS
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));   // handle preflight
// -------------------------------------------


app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'OneSimulation Backend API is running!',
    version: '1.0.0',
    endpoints: {
      brochure: '/api/brochure/download',
      order: '/api/order/submit',
      products: '/api/products',
      career: '/api/career/apply',
      demo: '/api/demo/book'
    }
  });
});

// Get client IP address
const getClientIP = (req) => {
  return req.headers['x-forwarded-for'] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress ||
         (req.connection.socket ? req.connection.socket.remoteAddress : null);
};

// API Routes
// 1. Brochure Download API
app.post('/api/brochure/download', async (req, res) => {
  try {
    const {
      productName,
      name,
      email,
      contactNumber,
      location,
      institution,
      acceptTerms
    } = req.body;

    console.log('📥 Received brochure download request:', {
      productName,
      name,
      email,
      contactNumber,
      location,
      institution,
      acceptTerms
    });

    // Validation
    if (!productName || !name || !email || !contactNumber || !location || !institution) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (!acceptTerms) {
      return res.status(400).json({
        success: false,
        message: 'Terms and conditions must be accepted'
      });
    }

    // Get client information
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    // Insert into database
    const [result] = await pool.execute(`
      INSERT INTO brochure_downloads 
      (product_name, customer_name, email, contact_number, location, institution, terms_accepted, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [productName, name, email, contactNumber, location, institution, acceptTerms, ipAddress, userAgent]);

    console.log('✅ Brochure download recorded:', {
      id: result.insertId,
      product: productName,
      customer: name,
      email: email,
      contactNumber: contactNumber,
      location: location,
      institution: institution
    });

    res.json({
      success: true,
      message: 'Brochure download recorded successfully',
      downloadId: result.insertId
    });

  } catch (error) {
    console.error('❌ Brochure download error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 2. Product Order API
app.post('/api/order/submit', async (req, res) => {
  try {
    const {
      productName,
      name,
      email,
      contactNumber,
      message,
      location,
      institution,
      deliveryAddress,
      acceptTerms
    } = req.body;

    // Validation
    if (!productName || !name || !email || !contactNumber || !location || !institution || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided'
      });
    }

    if (!acceptTerms) {
      return res.status(400).json({
        success: false,
        message: 'Terms and conditions must be accepted'
      });
    }

    // Get client information
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    // Insert into database
    const [result] = await pool.execute(`
      INSERT INTO product_orders 
      (product_name, customer_name, email, contact_number, message, location, institution, delivery_address, terms_accepted, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [productName, name, email, contactNumber, message || '', location, institution, deliveryAddress, acceptTerms, ipAddress, userAgent]);

    console.log('✅ Product order recorded:', {
      id: result.insertId,
      product: productName,
      customer: name,
      email: email
    });

    res.json({
      success: true,
      message: 'Order submitted successfully',
      orderId: result.insertId
    });

  } catch (error) {
    console.error('❌ Product order error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 3. Get Products API
app.get('/api/products', async (req, res) => {
  try {
    const [products] = await pool.execute('SELECT * FROM products ORDER BY id');
    
    res.json({
      success: true,
      products: products
    });

  } catch (error) {
    console.error('❌ Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 4. Get Brochure Downloads Stats
app.get('/api/stats/brochures', async (req, res) => {
  try {
    const [downloads] = await pool.execute(`
      SELECT 
        product_name,
        COUNT(*) as download_count,
        DATE(download_date) as download_date
      FROM brochure_downloads 
      GROUP BY product_name, DATE(download_date)
      ORDER BY download_date DESC
    `);

    res.json({
      success: true,
      stats: downloads
    });

  } catch (error) {
    console.error('❌ Get brochure stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 5. Get Orders Stats
app.get('/api/stats/orders', async (req, res) => {
  try {
    const [orders] = await pool.execute(`
      SELECT 
        product_name,
        COUNT(*) as order_count,
        order_status,
        DATE(order_date) as order_date
      FROM product_orders 
      GROUP BY product_name, order_status, DATE(order_date)
      ORDER BY order_date DESC
    `);

    res.json({
      success: true,
      stats: orders
    });

  } catch (error) {
    console.error('❌ Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 6. Career Application API with File Upload
// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads', 'resumes');
    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename: timestamp_position_originalname
    const timestamp = Date.now();
    const position = req.body.position ? req.body.position.replace(/[^a-zA-Z0-9]/g, '_') : 'unknown';
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext);
    const uniqueFilename = `${timestamp}_${position}_${basename}${ext}`;
    cb(null, uniqueFilename);
  }
});

// File filter for resume uploads
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'), false);
  }
};

// Create multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

app.post('/api/career/apply', upload.single('resume'), async (req, res) => {
  try {
    const { position, name, email } = req.body;
    const resume = req.file;

    console.log('📥 Received career application:', {
      position,
      name,
      email,
      resume: resume ? {
        filename: resume.filename,
        originalName: resume.originalname,
        size: resume.size,
        mimetype: resume.mimetype
      } : 'No file'
    });

    // Validation
    if (!position || !name || !email) {
      // Delete uploaded file if validation fails
      if (resume) {
        fs.unlink(resume.path, (err) => {
          if (err) console.error('Error deleting file:', err);
        });
      }
      return res.status(400).json({
        success: false,
        message: 'Position, name, and email are required'
      });
    }

    if (!resume) {
      return res.status(400).json({
        success: false,
        message: 'Resume file is required'
      });
    }

    // Get client information
    const ipAddress = getClientIP(req);
    const userAgent = req.headers['user-agent'];

    // Insert into database
    const [result] = await pool.execute(`
      INSERT INTO career_applications 
      (position, applicant_name, email, resume_filename, resume_path, file_size, file_type, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      position,
      name,
      email,
      resume.filename,
      resume.path,
      resume.size,
      resume.mimetype,
      ipAddress,
      userAgent
    ]);

    console.log('✅ Career application recorded:', {
      id: result.insertId,
      position: position,
      applicant: name,
      email: email,
      resume: resume.filename
    });

    res.json({
      success: true,
      message: 'Application submitted successfully',
      applicationId: result.insertId,
      resumeFilename: resume.filename
    });

  } catch (error) {
    console.error('❌ Career application error:', error);
    
    // Delete uploaded file if there was an error
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Error deleting file:', err);
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
});

// 7. Get Career Applications (Admin endpoint)
app.get('/api/career/applications', async (req, res) => {
  try {
    const { status, position, limit = 50, offset = 0 } = req.query;
    
    let query = `
      SELECT 
        id,
        position,
        applicant_name,
        email,
        resume_filename,
        file_size,
        file_type,
        application_status,
        application_date,
        reviewed_date,
        notes
      FROM career_applications
    `;
    
    const conditions = [];
    const params = [];
    
    if (status) {
      conditions.push('application_status = ?');
      params.push(status);
    }
    
    if (position) {
      conditions.push('position LIKE ?');
      params.push(`%${position}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY application_date DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [applications] = await pool.execute(query, params);
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM career_applications';
    if (conditions.length > 0) {
      countQuery += ' WHERE ' + conditions.join(' AND ');
    }
    
    const [countResult] = await pool.execute(countQuery, params.slice(0, -2));
    const total = countResult[0].total;
    
    res.json({
      success: true,
      applications: applications,
      pagination: {
        total: total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });

  } catch (error) {
    console.error('❌ Get career applications error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 8. Update Application Status (Admin endpoint)
app.put('/api/career/applications/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    
    const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be one of: ' + validStatuses.join(', ')
      });
    }

    const [result] = await pool.execute(`
      UPDATE career_applications 
      SET application_status = ?, notes = ?, reviewed_date = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [status, notes || null, id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }

    console.log('✅ Application status updated:', {
      id: id,
      status: status,
      notes: notes
    });

    res.json({
      success: true,
      message: 'Application status updated successfully'
    });

  } catch (error) {
    console.error('❌ Update application status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// 9. Demo Booking API
// app.post('/api/demo/book', async (req, res) => {
//   try {
//     const {
//       name,
//       email,
//       contactNumber,
//       location
//     } = req.body;

//     // Validation
//     if (!name || !email || !contactNumber || !location) {
//       return res.status(400).json({
//         success: false,
//         message: 'Name, email, contact number, and location are required'
//       });
//     }

//     // Email validation
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide a valid email address'
//       });
//     }

//     // Insert into database
//     const [result] = await pool.execute(`
//       INSERT INTO demo_requests (
//         name, 
//         email, 
//         contact_number, 
//         location
//       ) VALUES (?, ?, ?, ?)
//     `, [
//       name,
//       email,
//       contactNumber,
//       location
//     ]);

//     console.log('✅ Demo request submitted:', {
//       id: result.insertId,
//       name: name,
//       email: email,
//       location: location
//     });

//     res.json({
//       success: true,
//       message: 'Demo request submitted successfully! Our team will contact you soon.',
//       requestId: result.insertId
//     });

//   } catch (error) {
//     console.error('❌ Demo booking error:', error);
//     res.status(500).json({
//       success: false,
//       message: 'Failed to submit demo request. Please try again.',
//       error: error.message
//     });
//   }
// });


app.post('/api/demo/book', async (req, res) => {
  try {
    // destructure incoming fields (frontend may send otherProduct or other_product)
    const {
      name,
      email,
      contactNumber,
      location,
      product,
      otherProduct,
      other_product // in case frontend uses snake_case
    } = req.body;

    // normalize / trim inputs
    const trimmedName = name && String(name).trim();
    const trimmedEmail = email && String(email).trim();
    const trimmedContact = contactNumber && String(contactNumber).trim();
    const trimmedLocation = location && String(location).trim();
    const trimmedProduct = product && String(product).trim();
    const trimmedOther = (otherProduct || other_product) ? String(otherProduct || other_product).trim() : '';

    // Basic validation
    if (!trimmedName || !trimmedEmail || !trimmedContact || !trimmedLocation) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, contact number, and location are required'
      });
    }

    if (!trimmedProduct) {
      return res.status(400).json({
        success: false,
        message: 'Please select a product'
      });
    }

    // If user chose "Other", require the other product text
    if (trimmedProduct === 'Other' && !trimmedOther) {
      return res.status(400).json({
        success: false,
        message: 'Please specify the product when selecting "Other"'
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Optional: basic phone length check (adjust to your rules)
    if (trimmedContact.length < 6 || trimmedContact.length > 30) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid contact number'
      });
    }

    // Determine final product name to store
    const finalProduct = trimmedProduct === 'Other' ? trimmedOther : trimmedProduct;

    // Insert into database (prepared statement prevents injection)
    const [result] = await pool.execute(
      `INSERT INTO demo_requests (
         name,
         email,
         contact_number,
         location,
         product_name,
         other_product
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        trimmedName,
        trimmedEmail,
        trimmedContact,
        trimmedLocation,
        // store the selected product (if not Other) or the label 'Other'
        trimmedProduct,
        // store the user-specified other text (or null if not provided)
        trimmedProduct === 'Other' ? finalProduct : null
      ]
    );

    console.log('✅ Demo request submitted:', {
      id: result.insertId,
      name: trimmedName,
      email: trimmedEmail,
      location: trimmedLocation,
      product: trimmedProduct,
      other_product: trimmedProduct === 'Other' ? finalProduct : null
    });

    res.json({
      success: true,
      message: 'Demo request submitted successfully! Our team will contact you soon.',
      requestId: result.insertId
    });
  } catch (error) {
    console.error('❌ Demo booking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit demo request. Please try again.',
      error: error.message
    });
  }
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: err.message
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();
    
    // Initialize database tables
    await initDatabase();
    
    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 API Documentation: http://localhost:${PORT}`);
      console.log(`🔗 Frontend URL: http://localhost:5173`);
    });

  } catch (error) {
    console.error('❌ Server startup failed:', error);
    process.exit(1);
  }
};

startServer(); 
