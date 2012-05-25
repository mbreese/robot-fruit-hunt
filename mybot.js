function new_game() {
   MyBot.init();
}

function make_move() {
   return MyBot.get_move(get_board());
}

var MyBot = {
   init: function() {
      MyBot.target_x = -1;
      MyBot.target_y = -1;
      MyBot.target_path = [];
      MyBot.move_num = 0;
   },

   get_move: function(board) {
      MyBot.move_num++;

      var x = get_my_x();
      var y = get_my_y();

      if (board[x][y] > 0) {
         if (MyBot.is_priority_target(board[x][y])) {
            logger("Taking a priority target");
            return TAKE;
         }
         if (MyBot.num_priority_targets() === 0 && board[x][y] > 0) {
            logger("No priority targets left... taking this one anyway");
            return TAKE;
         }
         if (board[x][y] > 0) {
            logger("Skipping fruit - not helpful");
         }
         // no point in taking a fruit that doesn't help us... so just keep moving
      }

      if (MyBot.target_path.length === 0) {
         logger("Need a target");
         MyBot.acquire_target(board);
      }

      if (board[MyBot.target_x][MyBot.target_y] === 0) {
         logger("Old target gone... need a new one");
         MyBot.acquire_target(board);
      }

      if (MyBot.target_path.length === 0) {
         logger("Passing - no where to go");
         return PASS;
      }

      var tp_x = MyBot.target_path[MyBot.target_path.length-1][0];
      var tp_y = MyBot.target_path[MyBot.target_path.length-1][1];
      if (tp_x != MyBot.target_x || tp_y != MyBot.target_y) {
         logger("Reacquiring target - only have a partial path");
         MyBot.acquire_target(board);
      }

      move = MyBot.target_path.shift();
      logger(move);

      if (move[0] == x+1) return EAST;
      if (move[0] == x-1) return WEST;
      if (move[1] == y-1) return NORTH;
      if (move[1] == y+1) return SOUTH;

      return PASS;
   },
   
   num_priority_targets: function() {
      count = 0;
      for (var i=0; i< get_total_item_count(); i++) {
         if (MyBot.is_priority_target(i)) {
            count++;
         }
      }
      return count;
   },

   is_priority_target: function(type) {
      if (type === 0) {
         return false;
      }
      return ((get_opponent_item_count(type) / get_total_item_count(type)) <= 0.5) && ((get_my_item_count(type) / get_total_item_count(type)) <= 0.5);
   },
   
   acquire_target: function(board) {
      logger("Finding a target");
      var fruits = [];

      for (var i=0; i<WIDTH; i++) {
         for (var j=0; j<HEIGHT; j++) {
            if (board[i][j] > 0) {
               total = get_total_item_count(board[i][j]);
               my_count = get_my_item_count(board[i][j]);
               opp_count = get_opponent_item_count(board[i][j]);

               fruits.push({
                  x: i,
                  y: j,
                  fruittype: board[i][j],
                  distance: MyBot.get_distance(i,j),
                  opp_distance: MyBot.get_opp_distance(i,j),
                  type_count: total,
                  type_avail: total - my_count - opp_count,
                  priority: MyBot.is_priority_target(board[i][j])
               });
               logger("fruit: "+i+","+j);
            }
         }
      }

      logger("Sorting fruit");
      fruits.sort(function(a,b) {
         // should probably weight these values... that way we can prioritize closer targets that might not be as high of value.
         // sort by type first
         if (a.fruittype != b.fruittype) {
            // priority first
            if (a.priority && !b.priority) {
               return -1;
            } else if (!a.priority && b.priority) {
               return 1;
            }

            // sort by type_count (lower is better)
            if (a.type_count < b.type_count) {
               return -1;
            } else if (a.type_count > b.type_count) {
               return 1;
            }

            // type availability (fewer is better)
            if (a.type_avail < b.type_avail) {
               return -1;
            } else if (a.type_avail > b.type_avail) {
               return 1;
            }
         }

         // items are same type, or types are equally desireable.
         // sort by distance to me

         if (a.distance < b.distance) {
            return -1;
         } else if (a.distance > b.distance) {
            return 1;
         }

         // sort by distance to opponent (reverse)
         if (a.opp_distance < b.opp_distance) {
            return 1;
         }

         // targets are equal in distance, just pick one at random
         return Math.random() - 0.5;

      });

      if (fruits.length === 0) {
         MyBot.target_path = [];
         return;
      }

      logger("Finding best path to best target");
      MyBot.target_x = fruits[0].x;
      MyBot.target_y = fruits[0].y;

      MyBot.target_path = MyBot.calc_optimal_path(MyBot.target_x, MyBot.target_y, board);

   },

   get_opp_distance: function(x, y) {
      return Math.abs(x-get_opponent_x()) + Math.abs(y-get_opponent_y());
   },

   get_distance: function(x, y) {
      return Math.abs(x-get_my_x()) + Math.abs(y-get_my_y());
   },

   calc_optimal_path: function(x, y, board) {
      // find all possible paths to target using a back tracking search
      var possible_paths = [];
      logger("Target : ("+x+","+y+")");
      logger("Start  : ("+get_my_x()+","+get_my_y()+")");
      MyBot.calc_path(x, y, [[get_my_x(), get_my_y()]], possible_paths);

      var best_path = [];
      var best_score = 0;

      for (var i=0; i<possible_paths.length; i++) {
         var path = possible_paths[i];
         var score = MyBot.count_fruit_along_path(path, board);
         if (score > best_score) {
            best_path = path;
            best_score = score;
         }
      }

      if (best_score > 0) {
         return best_path;
      } else{
         return possible_paths[0];
      }

   },

   calc_path: function(x, y, parent_path, paths) {
      var cur_x = parent_path[parent_path.length-1][0];
      var cur_y = parent_path[parent_path.length-1][1];

      if ((cur_x == x && cur_y == y) || parent_path.length > 20) {
         paths.push(parent_path.slice(1));
         return;
      }

      if (cur_x != x) {
         var clonex = parent_path.slice(0);
         if (cur_x > x) {
            clonex.push([cur_x-1, cur_y]);
         } else if (cur_x < x) {
            clonex.push([cur_x+1, cur_y]);
         }

         MyBot.calc_path(x, y, clonex, paths);
      }

      if (cur_y != y) {
         var cloney = parent_path.slice(0);
         if (cur_y > y) {
            cloney.push([cur_x, cur_y-1]);
         } else if (cur_y < y) {
            cloney.push([cur_x, cur_y+1]);
         }

         MyBot.calc_path(x, y, cloney, paths);
      }
   },

   count_fruit_along_path: function(path, board) {
      var count = 0;
      for (var i=0; i < path.length; i++) {
         var field = board[path[i][0]][path[i][1]];
         if (field > 0 && MyBot.is_priority_target(field)) {
            count++;
         }
      }
      return count;
   }
};

function logger(msg) {
//   console.log("["+MyBot.move_num+"] "+msg);
}