<?php

//This function will read the Google file as csv
function readCSV($csvFile){
    $file_handle = fopen($csvFile, 'r');
    while (!feof($file_handle) ) {
        $line_of_text[] = fgetcsv($file_handle, 1024);
    }
    fclose($file_handle);
    return $line_of_text;
}

//Put your Google file path here
$csv1File = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7c5VTvHNX2f_rmS3saDINDkB_KrKnON89cWhgI-AlIXHmxtND7HomV9w_1F17J8aPCf9guKhnUJh8/pub?gid=0&single=true&output=csv';
$csv2File = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7c5VTvHNX2f_rmS3saDINDkB_KrKnON89cWhgI-AlIXHmxtND7HomV9w_1F17J8aPCf9guKhnUJh8/pub?gid=1367376416&single=true&output=csv';
$csv3File = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7c5VTvHNX2f_rmS3saDINDkB_KrKnON89cWhgI-AlIXHmxtND7HomV9w_1F17J8aPCf9guKhnUJh8/pub?gid=1553832609&single=true&output=csv';

$csv = readCSV($csv1File);
$data = [];
foreach ($csv as $key => $item) {
    if($key == 0) {
        continue;
    }
    $object = [];
    $object['flatno'] = 'A-'.$item[0];
    $object['name'] = $item[1];
    $object['mobileno'] = $item[2];
    $object['twowheel1'] = $item[3];
    $object['twowheel2'] = $item[4];
    $object['fourwheel'] = $item[5];
    array_push($data,$object);
}
$csv = readCSV($csv2File);
foreach ($csv as $key => $item) {
    if($key == 0) {
        continue;
    }
    $object = [];
    $object['flatno'] = 'B-'.$item[0];
    $object['name'] = $item[1];
    $object['mobileno'] = $item[2];
    $object['twowheel1'] = $item[3];
    $object['twowheel2'] = $item[4];
    $object['fourwheel'] = $item[5];
    array_push($data,$object);
}
$csv = readCSV($csv3File);
foreach ($csv as $key => $item) {
    if($key == 0) {
        continue;
    }
    $object = [];
    $object['flatno'] = 'C-'.$item[0];
    $object['name'] = $item[1];
    $object['mobileno'] = $item[2];
    $object['twowheel1'] = $item[3];
    $object['twowheel2'] = $item[4];
    $object['fourwheel'] = $item[5];
    array_push($data,$object);
}
$response = [];
$response['data'] = $data;
echo json_encode($response);
exit();
//Start table with some default styles
// echo '<table id="myTable" class="table table-striped">';

// //Header of the table
// echo '<thead>
//         <tr>
//             <th>Name</th>
//             <th>Email</th>
//             <th>Show</th>
//         </tr>
//     </thead>';

// //For loop to get the content from each sheet cell
// foreach ($csv as $item) {
//   echo '<tr><td>' . $item[0] . '</td><td>' .$item[1] . '</td><td>' . $item[2] . '</td></tr>';
// }

// //End table
// echo '</table>';

?>