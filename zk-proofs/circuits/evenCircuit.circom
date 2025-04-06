pragma circom 2.0.0;

template IsEven() {
    signal input x;
    signal output out;

    out <== x % 2 === 0;
}

component main = IsEven();