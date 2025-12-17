// routes/order.routes.js

import express from 'express';
import { acceptWithdrawalRequest, addCoupon, createAd, createBanner, createFaq, createRider, deleteAd, deleteBanner, deleteCoupon, deleteFaq, deleteMessage, deleteNotification, deleteOrder, deletePeriodicOrder, deletePrescriptionForAdmin, deleteQuery, deleteRider, deleteRiderQuery, deleteUser, deleteWithdrawalRequest, editCoupon, getActivePharmacies, getAllAds, getAllBanners, getAllCoupons, getAllFaqs, getAllFaqsForRider, getAllFaqsForUser, getAllMessages, getAllNotifications, getAllOrders, getAllPayments, getAllPreodicOrders, getAllPrescriptionOrders, getAllPrescriptionsForAdmin, getAllQueries, getAllRiderQueries, getAllRiders, getAllUsers, getAllVendorQueries, getAllWithdrawalRequestsController, getCancelledOrders, getCurrentBaseFare, getDashboardData, getDeliveredOrders, getInactivePharmacies, getOnlineRiders, getPrescriptionOrders, getRefundOrders, getSingleOrder, getSingleUser, getTodaysOrders, loginAdmin, logoutAdmin, registerAdmin, sendMessage, setBaseFareForAllRiders, updateAd, updateBanner, updateNotification, updateOrderStatus, updatePeriodicOrder, updateQueryStatus, updateRider, updateRiderBaseFare, updateRiderQuery, updateUser, updateUserStatus } from '../Controller/AdminControler.js';

const router = express.Router();

// PUT - Update order status and notify user
router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post('/logout', logoutAdmin);
router.put('/ordersstatus/:userId/:orderId', updateOrderStatus);
router.get('/getallusers', getAllUsers);
router.get('/getsingleuser/:userId', getSingleUser);
router.put('/updateusers/:userId', updateUser);
router.delete('/deleteusers/:userId', deleteUser);
router.get('/getallorders', getAllOrders);
router.get('/getallprescriptionorders', getPrescriptionOrders);
router.get("/todayorders", getTodaysOrders);
router.get('/getallcancelledorders', getCancelledOrders);
router.get('/getallactiveorders', getActivePharmacies);
router.get('/getallinactiveorders', getInactivePharmacies);
router.get('/getallpayments', getAllPayments);
router.get('/singleorder/:orderId', getSingleOrder);
router.delete('/deleteorder/:orderId', deleteOrder);
router.put("/updatestatus/:userId", updateUserStatus)
router.post("/create-rider", createRider);
router.put("/update-rider/:riderId", updateRider);
router.delete("/delete-rider/:riderId", deleteRider);
router.get("/allriders", getAllRiders);
router.get("/onlineriders", getOnlineRiders);
router.post("/create-ads", createAd);
router.get("/allads", getAllAds);
router.put("/updateads/:id", updateAd);
router.delete("/deleteads/:id", deleteAd);
router.get("/allqueries", getAllQueries);
router.get("/allriderqueries", getAllRiderQueries);
router.put("/updatequeries/:id", updateQueryStatus);
router.delete("/deletequeries/:id", deleteQuery);
router.get("/alluploadprescription", getAllPrescriptionsForAdmin);
router.delete("/deleteprescription/:id", deletePrescriptionForAdmin);
router.get("/allnotifications", getAllNotifications);
router.delete("/deletenotification/:id", deleteNotification);
router.put('/updatenotifications/:id', updateNotification); // <-- ✅ new update route
router.get("/delivered-orders", getDeliveredOrders);
router.get("/refund-orders", getRefundOrders);
router.get("/dashboard", getDashboardData);
router.post("/createplan", createBanner);
router.get("/getallbanners", getAllBanners);
router.put("/updatebanner/:id", updateBanner);
router.delete("/deletebanner/:id", deleteBanner);
router.get("/withdrawal-requests", getAllWithdrawalRequestsController);
router.put("/approvewithdrawalrequests/:requestId", acceptWithdrawalRequest);
router.delete("/deletewithdrawal-requests/:requestId", deleteWithdrawalRequest);
router.post("/send-message", sendMessage);
router.get("/allmessages", getAllMessages);
router.delete("/deletemessages/:id", deleteMessage);
router.get('/riderqueries', getAllRiderQueries);
router.get('/vendorqueries', getAllVendorQueries);
router.put('/updatequeries/:queryId', updateRiderQuery); // :queryId in URL params
router.delete('/deletequeries/:queryId', deleteRiderQuery); // :queryId in URL params
router.get('/allpreodicorders', getAllPreodicOrders);
router.put('/updatepreodicorders/:userId/:orderId', updatePeriodicOrder);
router.delete('/deletepreodicorders/:orderId', deletePeriodicOrder);
router.post("/createfaq", createFaq);
router.get("/allfaq", getAllFaqs);
router.get("/riderfaq", getAllFaqsForRider);
router.get("/userfaq", getAllFaqsForUser);
router.delete('/deletefaq/:id', deleteFaq);
// Route to add a new coupon
router.post("/addcoupon", addCoupon);

// Route to get all coupons
router.get("/getcoupons", getAllCoupons);
router.put("/editcoupon/:id", editCoupon);
router.delete("/deletecoupon/:id", deleteCoupon);

// Base fare routes
router.post("/base-fare/set-all", setBaseFareForAllRiders);
router.get("/base-fare/current", getCurrentBaseFare);
router.put("/base-fare/rider/:riderId", updateRiderBaseFare);

router.get('/prescription-orders', getAllPrescriptionOrders);


export default router;
