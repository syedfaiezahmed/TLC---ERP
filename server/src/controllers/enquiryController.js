import Enquiry from '../models/Enquiry.js';

// @desc    Get all enquiries
// @route   GET /api/enquiries
// @access  Private
const getEnquiries = async (req, res) => {
  try {
    const enquiries = await Enquiry.find({ company: req.user.company })
      .populate('courseOfInterest', 'name')
      .sort({ createdAt: -1 });
    res.json(enquiries);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create an enquiry
// @route   POST /api/enquiries
// @access  Private
const createEnquiry = async (req, res) => {
  try {
    const { name, contact, email, courseOfInterest, source, remarks, followUpDate } = req.body;

    const enquiry = new Enquiry({
      company: req.user.company,
      name,
      contact,
      email,
      courseOfInterest,
      source,
      remarks,
      followUpDate
    });

    const createdEnquiry = await enquiry.save();
    res.status(201).json(createdEnquiry);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update an enquiry
// @route   PUT /api/enquiries/:id
// @access  Private
const updateEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({ _id: req.params.id, company: req.user.company });

    if (enquiry) {
      enquiry.name = req.body.name || enquiry.name;
      enquiry.contact = req.body.contact || enquiry.contact;
      enquiry.email = req.body.email || enquiry.email;
      enquiry.courseOfInterest = req.body.courseOfInterest || enquiry.courseOfInterest;
      enquiry.source = req.body.source || enquiry.source;
      enquiry.status = req.body.status || enquiry.status;
      enquiry.remarks = req.body.remarks || enquiry.remarks;
      enquiry.followUpDate = req.body.followUpDate || enquiry.followUpDate;

      const updatedEnquiry = await enquiry.save();
      res.json(updatedEnquiry);
    } else {
      res.status(404).json({ message: 'Enquiry not found' });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete an enquiry
// @route   DELETE /api/enquiries/:id
// @access  Private
const deleteEnquiry = async (req, res) => {
  try {
    const enquiry = await Enquiry.findOne({ _id: req.params.id, company: req.user.company });

    if (enquiry) {
      await enquiry.deleteOne();
      res.json({ message: 'Enquiry removed' });
    } else {
      res.status(404).json({ message: 'Enquiry not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export {
  getEnquiries,
  createEnquiry,
  updateEnquiry,
  deleteEnquiry
};
