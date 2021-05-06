module.exports = app => {
    const { router, controller } = app;
    router.get('/', controller.home.index);
    router.get('/getAll', controller.home.getAll);
    router.get('/list', controller.home.list);
};
