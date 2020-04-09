async function parseData(pallet, extrinsic) {
    // Benchmark data is in *.txt
    input = './data/' + pallet + "_" + extrinsic + ".txt";

    let text = await d3.text(input);
    let component_metadata = await d3.json('./metadata.json');

    let components = {...component_metadata["common"], ...component_metadata[pallet] }

    let charts = document.getElementsByClassName('chart');

    for (chart of charts) {
        // Clear charts
        while (chart.firstChild) {
            chart.removeChild(chart.firstChild);
        }
    }

    // Benchmark data is currently the first continuous block of text
    let benchmark_data = text.split('\n\n')[0];

    // Separate the first row which is metadata
    let benchmark_metadata = benchmark_data
        .split('\n')[0]
        .replace(/[",]/g, '')
        .split(' ');

    document.getElementById('dashboard-title').innerText = benchmark_metadata.join(' ');

    let repeat = parseInt(benchmark_metadata[benchmark_metadata.findIndex((e) => e == "Repeat:") + 1]);

    // The actual CSV data is the rest
    let data = benchmark_data
        .split('\n')
        .slice(1)
        .join('\n');

    let csv = await d3.csvParse(data);

    createTable(csv, components);

    let split_data = splitBenchmarks(csv, repeat);

    let keys = Object.keys(split_data);

    createCharts(split_data, keys, benchmark_metadata, components);
}

function createTable(data, components) {
    let keys = Object.keys(data[0]);

    let table = document.getElementById('raw-data');

    // Clear table
    while (table.firstChild) {
        table.removeChild(table.firstChild);
    }

    let thead = document.createElement('thead');
    let tbody = document.createElement('tbody');

    let tr = document.createElement('tr');
    for (key of keys) {
        let th = document.createElement('th');
        th.innerText = key + ' (' + components[key] + ')';

        tr.appendChild(th);
    }

    for (row of data) {
        let tr2 = document.createElement('tr');
        for (key of keys) {
            let td = document.createElement('td');
            td.innerText = row[key];
            tr2.appendChild(td);
        }
        tbody.appendChild(tr2);
    }

    thead.appendChild(tr);
    table.appendChild(thead);
    table.appendChild(tbody);
}

function splitBenchmarks(data, repeat) {
    let keys = Object.keys(data[0]);

    // Remove known column names
    keys = keys.filter(item => item !== "time" && item !== "extrinsic_time" && item !== "storage_root_time" && item !== "commit_db_time")

    let split_data = {};
    for (key of keys) {
        split_data[key] = [];
    }

    // Handle the trivial case
    if (keys.length == 1) {
        split_data[key] = data;
        return split_data;
    }

    for (let i = 0; i < data.length; i += repeat) {
        for (key of keys) {
            if (data[i + repeat]) {
                if (data[i][key] != data[i + repeat][key]) {
                    split_data[key] = split_data[key].concat(data.slice(i, i + repeat));
                    break;
                }
            }
        }
    }

    return split_data;
}

function createCharts(split_data, keys, metadata, components) {
    let extrinsic = metadata[3];

    var counter = 0;
    for (key of keys) {
        let time_names = ["extrinsic_time", "storage_root_time"];
        for (time_name of time_names) {
            let data = split_data[key];

            let x = data.map(row => {
                return row[key];
            });

            // backwards compatibility hack; TODO DELETE THIS
            if ('time' in row) {
                if (time_name == "extrinsic_time") {
                    time_name = 'time'
                } else {
                    continue;
                }
            }

            let time = data.map(row => {
                return row[time_name] / 1000000;
            });

            const someIsNotZero = time.some(item => item !== 0);
            if (!someIsNotZero) {
                continue;
            }

            var trace = {
                x: x,
                y: time,
                mode: 'markers',
                type: 'scatter',
                name: 'Raw Values',
                marker: { size: 6, color: 'grey' },
                hoverinfo: 'skip'
            };

            var average = {
                type: 'scatter',
                x: x,
                y: time,
                transforms: [{
                    type: 'aggregate',
                    groups: x,
                    aggregations: [{ target: 'y', func: 'avg', enabled: true }]
                }],
                name: 'Average',
                line: { color: 'orange' }
            };

            var median = {
                type: 'scatter',
                x: x,
                y: time,
                transforms: [{
                    type: 'aggregate',
                    groups: x,
                    aggregations: [{ target: 'y', func: 'median', enabled: true }]
                }],
                name: 'Median',
                line: { color: 'yellow' }
            };

            var min = {
                type: 'scatter',
                mode: 'markers',
                x: x,
                y: time,
                transforms: [{
                    type: 'aggregate',
                    groups: x,
                    aggregations: [{ target: 'y', func: 'min', enabled: true }]
                }],
                name: 'Min',
                marker: { size: 4, color: 'green' }
            };

            var max = {
                type: 'scatter',
                mode: 'markers',
                x: x,
                y: time,
                transforms: [{
                    type: 'aggregate',
                    groups: x,
                    aggregations: [{ target: 'y', func: 'max', enabled: true }]
                }],
                name: 'Max',
                marker: { size: 4, color: 'red' }
            };

            let keyName = key + ' (' + components[key] + ')';

            let fixed_data = keys
                .filter(x => {
                    return x != key;
                })
                .map(x => {
                    return x + ': ' + data[0][x];
                })
                .join(', ');

            if (fixed_data) {
                fixed_data = ' (' + fixed_data + ')';
            }

            var layout = {
                title: {
                    text: time_name + ': ' + extrinsic + ' over ' + keyName + fixed_data
                },
                xaxis: {
                    title: {
                        text: keyName
                    }
                },
                yaxis: {
                    title: {
                        text: 'Time (ms)'
                    }
                }
            };

            var chart = [trace, min, median, average, max];

            let chartDiv = document.createElement('div');
            chartDiv.id = 'myChart' + counter;
            chartDiv.classList.add('my-4', 'w-100', 'chart');

            document.getElementById('charts').appendChild(chartDiv);

            Plotly.newPlot('myChart' + counter, chart, layout);
            counter += 1;
        }
    }
}