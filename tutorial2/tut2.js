import {MnistData} from './data.js';

let getModel = () => {
    const model = tf.sequential();

    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const IMAGE_CHANNELS = 1;

    //first layer of the convolutional neural network
    //we need to specify the input shape
    // we specify some parameters for the convolution operation
    //filters: these are what we are tying to learn. We effective convolve the image on a grid by grid basis with these until we 'see' the image we are looking for.
    //kernel size is a 5x5 matrix for multiplication
    //strides: filter moves x pixel by x pixel
    //one could pad the image to prevent the image shrinking might want to add this later
    model.add(tf.layers.conv2d({
            inputShape: [IMAGE_WIDTH, IMAGE_HEIGHT, IMAGE_CHANNELS],
            kernelSize: 5,
            filters: 8,
            strides: 1,
            activation: 'relu',
            kernelInitializer: 'varianceScaling'
        })
    );

    //This is a max pooling layer, it is a form of downsampling using the max
    //values in each window, this is to give a sort or hierarchical to the network and to reduce the space for performance
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));

    //more convolution
    model.add(tf.layers.conv2d({
        kernelSize: 5,
        filters: 16,
        strides: 1,
        activation: 'relu',
        kernelInitializer: 'varianceScaling'
    }));

    //more pooling
    model.add(tf.layers.maxPooling2d({poolSize: [2, 2], strides: [2, 2]}));


    //now we flatten to a 1D vector  to prepare for the last layer which has 10 outputs
    model.add(tf.layers.flatten());

    //Our last layer in now a dense layer (standard neural network) with 10 output units (one for each number)
    const NUM_OUTPUT_CLASSES = 10;
    model.add(tf.layers.dense({
        units: NUM_OUTPUT_CLASSES,
        kernelInitializer: 'varianceScaling',
        activation: 'softmax'
    }));

    //optimizer we use adam which is a variation on gradient descent designed to reduce oscillation in the steps
    const optimizer = tf.train.adam();
    model.compile({
        optimizer: optimizer,
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
    });

    return model;

};

let train = async (model, data) => {
    const metrics = ['loss', 'val_loss', 'acc', 'val_acc'];
    const container = {
        name: 'Model Training', styles: {height: '1000px'}
    };
    const fitCallbacks = tfvis.show.fitCallbacks(container, metrics);

    const BATCH_SIZE = 512;
    const TRAIN_DATA_SIZE = 5500;
    const TEST_DATA_SIZE = 1000;

    const [trainXs, trainYs] = tf.tidy(() => {
        const d = data.nextTrainBatch(TRAIN_DATA_SIZE);
        return [
            d.xs.reshape([TRAIN_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    const [testXs, testYs] = tf.tidy(() => {
        const d = data.nextTestBatch(TEST_DATA_SIZE);
        return [
            d.xs.reshape([TEST_DATA_SIZE, 28, 28, 1]),
            d.labels
        ];
    });

    return model.fit(trainXs, trainYs, {
        batchSize: BATCH_SIZE,
        validationData: [testXs, testYs],
        epochs: 30,
        shuffle: true,
        callbacks: fitCallbacks
    });
};



let showExamples = async (data) => {
    // Create a container in the visor
    const surface =
        tfvis.visor().surface({name: 'Input Data Examples', tab: 'Input Data'});

    // Get the examples
    const examples = data.nextTestBatch(20);
    const numExamples = examples.xs.shape[0];

    // Create a canvas element to render each example
    for (let i = 0; i < numExamples; i++) {
        const imageTensor = tf.tidy(() => {
            // Reshape the image to 28x28 px
            return examples.xs
                .slice([i, 0], [1, examples.xs.shape[1]])
                .reshape([28, 28, 1]);
        });

        const canvas = document.createElement('canvas');
        canvas.width = 28;
        canvas.height = 28;
        canvas.style = 'margin: 4px;';
        await tf.browser.toPixels(imageTensor, canvas);
        surface.drawArea.appendChild(canvas);

        imageTensor.dispose();
    }
};

const classNames = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

let doPredication = (model, data, testDataSize = 500) => {
    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const testData = data.nextTestBatch(testDataSize);
    const testxs = testData.xs.reshape([testDataSize, IMAGE_WIDTH, IMAGE_HEIGHT, 1]);
    const labels = testData.labels.argMax([-1]);
    const preds = model.predict(testxs).argMax([-1]);

    testxs.dispose();
    return [preds, labels];
};

const classifyPoint = async (model, point) => {
    const IMAGE_WIDTH = 28;
    const IMAGE_HEIGHT = 28;
    const pointxs = point.reshape([1, IMAGE_WIDTH, IMAGE_HEIGHT, 1]);
    const pred = model.predict(pointxs, {batchSize: 1}).argMax([-1]);
    const predVal = await pred.data();
    return predVal[0]
};


//this is to grab a random example from the data set, return its label and its prediction, the idea is to get a feel for how well the neural net does on a single example
const getSingleDataPoint = (data) => {
    let point = data.nextTestBatch(1);
    return tf.tidy(() => {
        return point.xs
            .slice([0, 0], [1, point.xs.shape[1]])
            .reshape([28, 28, 1]);
    });
};

const displaySingleNumber = async (imageTensor, prediction) => {
    //Create a container in the visor
    const surface =
        tfvis.visor().surface({name: `Predicted value is ${prediction}`, tab: 'Data'});

    //display point
    const canvas = document.createElement('canvas');
    canvas.width = 28;
    canvas.height = 28;
    canvas.style = 'margin: 4px;';
    await tf.browser.toPixels(imageTensor, canvas);
    surface.drawArea.appendChild(canvas);

    imageTensor.dispose();

};

let showAccuracy = async (model, data) => {
    const [preds, labels] = doPredication(model, data);
    const classAccuracy = await tfvis.metrics.perClassAccuracy(labels, preds);
    const container = {name: 'Accuracy', tab: 'Evaluation'};
    tfvis.show.perClassAccuracy(container, classAccuracy, classNames);

    labels.dispose();
};

let showConfusion = async (model, data) => {
    //this shows a confusion matrix allowing us to see where the model is having classification issues
    const [preds, labels] = doPredication(model, data);
    const confusionMatrix = await tfvis.metrics.confusionMatrix(labels, preds);
    const container = {name: 'Confusion Matrix', tab: 'evaluation'};
    tfvis.render.confusionMatrix(
        container, {values: confusionMatrix}, classNames
    );
    labels.dispose();
};


let run = async () => {
    const data = new MnistData();
    await data.load();
    await showExamples(data);
    const model = getModel();
    tfvis.show.modelSummary({name: 'Model Architecture'}, model);
    await train(model, data);
    await showAccuracy(model, data);
    await showConfusion(model, data);
    const pointToPredict = getSingleDataPoint(data);
    const prediction = await classifyPoint(model, pointToPredict);
    await displaySingleNumber(pointToPredict, prediction);
};

document.addEventListener('DOMContentLoaded', run);