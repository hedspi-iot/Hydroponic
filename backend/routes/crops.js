const router = require('express').Router();
const auth = require('../middleware/auth');
const Farm = require('../models/Farm');
const Crop = require('../models/Crop');

// create crop with farmId
router.post('/create/:id', auth, async (req, res) => {
  // only admin or staff work in farm can create crop
  let farmId = req.params.id;
  let isHave = req.user.farms.filter(farm => {
    return JSON.stringify(farm._id) === JSON.stringify(farmId);
  });

  if (isHave.length > 0) {
    try {
      let crop = new Crop(req.body);
      let cropData = await crop.save();

      await Farm.updateOne(
        { _id: farmId },
        {
          $push: { crops: [{ _id: cropData._id }] }
        }
      );

      res.status(201).json({
        success: true,
        message: 'Create crop successfully'
      });
    } catch (error) {
      res.status(400).send(error);
    }
  } else {
    res.status(400).json({
      success: false,
      message: 'You do not have permission to create a new Crop'
    });
  }
});

module.exports = router;
