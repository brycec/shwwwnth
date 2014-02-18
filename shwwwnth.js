/**
 * HORN wave oscillator
 */
var Horn = function(audiolet, nume, deno, mul) {
    AudioletNode.call(this, audiolet, 3, 1);
    this.nume = new AudioletParameter(this, 0, nume || 10);
    this.deno = new AudioletParameter(this, 1, deno || 90);
    this.mul = new AudioletParameter(this, 2, mul || 1);
    this.params = [this.nume, this.deno, this.mul];
    
    this.val = 0;
    this.phase = 1; // 1 or -1
    this.P = 10.0 * 255 / this.audiolet.device.sampleRate; // 1/255 is 20hz
};
extend(Horn, AudioletNode);

/**
 * Process samples
 */
Horn.prototype.generate = function() {
    var output = this.outputs[0],
        nume = this.nume.getValue(),
        deno = this.deno.getValue(),
        slope = this.phase * this.P * nume;
        
    this.val += slope;
    if (this.val > deno || this.val < 0) {
        this.phase = this.val < 0 ? 1 : -1;
        
        // bounce off the limit. flip sign if less than 0 otherwise subtract by the diff
        this.val = this.val < 0 ? -this.val : deno - (this.val - deno);
    }
    
    output.samples[0] = this.val * (this.mul.getValue() / 128);
};
Horn.prototype.set = function(nume,deno) {
    this.nume.setValue(nume);
    this.deno.setValue(deno);
}

/**
 * Slow a value change
 */
var Slew = function(audiolet, inn, upp, donn) {
    AudioletNode.call(this, audiolet, 3, 1);
    this.inn = new AudioletParameter(this, 0, inn || 0);
    this.upp = new AudioletParameter(this, 1, upp || 50);
    this.donn = new AudioletParameter(this, 2, donn || 50);
    this.params = [this.inn, this.upp, this.donn];
    
    this.lastVal = this.inn.getValue();
    this.R = 255 / this.audiolet.device.sampleRate;
};
extend(Slew, AudioletNode);

Slew.prototype.rate = function(scale) {
    // scales the diff over one second (sampleRate) with scale of 0 or instantly at 255
    return 1 / (1 + this.audiolet.device.sampleRate - scale/255*(this.audiolet.device.sampleRate));
}

Slew.prototype.generate = function() {
    var output = this.outputs[0],
        inn = this.inn.getValue(),
        upp = this.upp.getValue(),
        donn = this.donn.getValue(),
        diff = Math.abs(inn - this.lastVal),
        val = this.lastVal;
    
    if (this.lastVal > inn) { // going donn
        val = val - (diff * this.rate(donn));
    } else { // going upp
        val = val + (diff * this.rate(upp));
    }
    this.lastVal = val;
    
    output.samples[0] = val;
};

/**
 * Major (button). id is DOM element id
 */
var Major = function(audiolet, id, mul) {
    var _this = this;
    AudioletNode.call(this, audiolet, 1, 1);
    this.mul = new AudioletParameter(this, 0, mul || 255);
    this.params = [this.mul];
    
    this.val = 0;
    
    this.el = document.getElementById(id);
    this.el.addEventListener('mousedown', function(){ _this.val = 1; });
    this.el.addEventListener('mouseup', function(){ _this.val = 0; });
};
extend(Major, AudioletNode);

Major.prototype.generate = function() {
    this.outputs[0].samples[0] = this.val * this.mul.getValue();
}




run = function(array) {
    if (typeof array[0] === 'string') {
        var op = ops[array[0]], other;
        
        for (var i = 1; i < array.length; i++) {
            if (typeof array[i] === 'number') {
                op.params[i-1].setValue(array[i]);
            } else if (Array.isArray(array[i])) {
                other = run(array[i]);
                console.log(op, other);
                other.connect(op, 0, i-0.5);
            } else {
                console.log('something weird: ', array[i]);
            }
        }
        return op;
    } else if (Array.isArray(array[0])) {
        return run(array[0]); // derp?
    } else {
        return array[0]; // derrrp???
    }
}

parse = function (str) {
    return JSON.parse(str.replace(
                /^\s+/, '').replace(/\s+$/, '').replace( // trim whitespace
                /\[(\w+)\s+(\w)\]/g, '$1$2').replace(  // [horn b] -> hornb
                /\(/g, '[').replace( // ( -> [
                /\)/g, ']').replace( // ) -> ]
                /\s+(?!])/g, ', ').replace( // bleh bleh -> bleh, bleh
                /([A-Za-z]+)/g, '"$1"')); // bleh -> "bleh"
}

go = function() {

    if (window.a) {
        a.output.remove();
    }
    a = new Audiolet(22050);
    mul = new Multiply(a, 1/255);
    trans = new Subtract(a, 1);
    mix = new UpMixer(a, 1);
    mix.connect(mul);
    mul.connect(trans);
    trans.connect(a.output);
    
    ops = {
        "out": mix,
    
        "horn": new Horn(a),
        "hornb": new Horn(a),
        "hornc": new Horn(a),
        
        "slew": new Slew(a),
        "slewb": new Slew(a),
        "slewc": new Slew(a),
        
        "major": new Major(a, 'majora'),
        "majorb": new Major(a, 'majorb'),
        "majorc": new Major(a, 'majorc')
    }
    
    
    sh = document.getElementById('shlisp').value;
    v = run(parse(sh), console.log(parse(sh)));
    
    console.log(v);
    
    var el = document.getElementById('jones');
    if (el.firstChild) el.removeChild(el.firstChild);
    var jones = new WavyJones(a.output.device.sink._context, 'jones');
    a.output.device.sink._node.connect(jones);
    jones.connect(a.output.device.sink._context.destination);
    jones.lineColor = '#00eeee'
}
