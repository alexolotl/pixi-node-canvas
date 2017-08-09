module.exports = (data) => { // function to copy to clipboard
    var proc = require('child_process').spawn('pbcopy');
    proc.stdin.write(data); proc.stdin.end();
}
